// Delivery tracking (BUILD.md T09, Phase B: status-based, no live GPS).
// Server-only: every write goes through these helpers with the service role,
// after the caller has proved who they are (seller session or rider link).
// Import only from route handlers and server components (uses node:crypto).

import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DELIVERY_STATUSES = [
  'awaiting_dispatch',
  'assigned',
  'picked_up',
  'in_transit',
  'arrived',
  'delivered',
  'failed_attempt',
  'returned',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Plain-language labels (buyer and seller see the same words). */
export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  awaiting_dispatch: 'Waiting for a rider',
  assigned: 'Rider assigned',
  picked_up: 'Picked up from the store',
  in_transit: 'On the way',
  arrived: 'Rider has arrived',
  delivered: 'Delivered',
  failed_attempt: 'Delivery attempt failed',
  returned: 'Returned to the store',
};

/** Allowed moves. "delivered" additionally needs the buyer's code (or a seller confirmation with a note). */
export const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  awaiting_dispatch: ['assigned'],
  assigned: ['picked_up', 'awaiting_dispatch'],
  picked_up: ['in_transit', 'failed_attempt'],
  in_transit: ['arrived', 'failed_attempt'],
  arrived: ['delivered', 'failed_attempt'],
  failed_attempt: ['assigned', 'returned'],
  delivered: [],
  returned: [],
};

export const FAILURE_REASONS = [
  'Buyer not reachable',
  'Wrong or unclear address',
  'Buyer refused the order',
  'Buyer asked to reschedule',
  'Item damaged',
] as const;

export const isStatus = (v: unknown): v is DeliveryStatus =>
  typeof v === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(v);

export function newToken(): string {
  return randomBytes(18).toString('base64url'); // 24 chars, unguessable
}
export function newOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}
export function otpMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given.replace(/\D/g, '').slice(0, 4).padEnd(4, 'x'));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Create the delivery for an order (idempotent: returns the existing one). */
export async function ensureDelivery(
  svc: SupabaseClient,
  order: { id: string; store_id: string },
): Promise<{ id: string; tracking_token: string } | null> {
  const { data: existing } = await svc.from('deliveries').select('id, tracking_token').eq('order_id', order.id).maybeSingle();
  if (existing) return existing as { id: string; tracking_token: string };
  const { data: created, error } = await svc
    .from('deliveries')
    .insert({ order_id: order.id, store_id: order.store_id, tracking_token: newToken() })
    .select('id, tracking_token')
    .single();
  if (error || !created) return null;
  await svc.from('delivery_secrets').insert({ delivery_id: created.id, otp: newOtp() });
  await svc.from('delivery_events').insert({ delivery_id: created.id, status: 'awaiting_dispatch', actor: 'system', note: 'Order placed' });
  return created as { id: string; tracking_token: string };
}

export type Actor = 'seller' | 'rider';

/**
 * Apply a status change. Checks the move is allowed and, for "delivered",
 * checks the buyer's code (rider and seller) or accepts a seller
 * confirmation that must carry a note. Writes the timeline event.
 */
export async function applyStatus(
  svc: SupabaseClient,
  delivery: { id: string; status: DeliveryStatus; order_id: string; rider_id: string | null },
  next: DeliveryStatus,
  opts: { actor: Actor; note?: string; reason?: string; otp?: string; sellerConfirm?: boolean },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!NEXT[delivery.status].includes(next)) {
    return { ok: false, code: 'invalid_transition', message: `Can't go from "${STATUS_LABEL[delivery.status]}" to "${STATUS_LABEL[next]}".` };
  }
  if (next === 'assigned' && !delivery.rider_id) {
    return { ok: false, code: 'no_rider', message: 'Pick a rider first.' };
  }
  const note = (opts.note ?? '').trim().slice(0, 200);
  const update: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };

  if (next === 'delivered') {
    if (opts.otp) {
      const { data: secret } = await svc.from('delivery_secrets').select('otp, attempts').eq('delivery_id', delivery.id).maybeSingle();
      if (!secret) return { ok: false, code: 'no_code', message: 'This delivery has no handover code.' };
      if (secret.attempts >= 5) return { ok: false, code: 'locked', message: 'Too many wrong codes. The seller must confirm this delivery.' };
      if (!otpMatches(secret.otp, opts.otp)) {
        await svc.from('delivery_secrets').update({ attempts: secret.attempts + 1 }).eq('delivery_id', delivery.id);
        return { ok: false, code: 'wrong_code', message: 'That code is not right. Ask the buyer to read it from their tracking page.' };
      }
      update.proof = 'otp';
    } else if (opts.actor === 'seller' && opts.sellerConfirm && note.length >= 4) {
      update.proof = 'seller_confirmed';
    } else {
      return { ok: false, code: 'proof_needed', message: 'Enter the buyer’s 4-digit code, or confirm with a short note.' };
    }
    update.delivered_at = new Date().toISOString();
  }
  if (next === 'failed_attempt') {
    const reason = (opts.reason ?? '').trim().slice(0, 160);
    if (!reason) return { ok: false, code: 'reason_needed', message: 'Pick why the delivery failed.' };
    update.failure_reason = reason;
  }
  if (next === 'assigned' && delivery.status === 'failed_attempt') update.failure_reason = '';
  if (next === 'awaiting_dispatch') {
    update.rider_id = null;
    update.rider_token = null;
  }

  const { error } = await svc.from('deliveries').update(update).eq('id', delivery.id).eq('status', delivery.status);
  if (error) return { ok: false, code: 'update_failed', message: 'Could not save. Try again.' };
  await svc.from('delivery_events').insert({
    delivery_id: delivery.id,
    status: next,
    actor: opts.actor,
    note: next === 'failed_attempt' ? [opts.reason, note].filter(Boolean).join(' · ').slice(0, 200) : update.proof === 'seller_confirmed' ? `Confirmed by seller: ${note}` : note,
  });
  // A delivered, already-paid order is done.
  if (next === 'delivered') {
    await svc.from('orders').update({ status: 'fulfilled' }).eq('id', delivery.order_id).eq('status', 'paid');
  }
  return { ok: true };
}

/** First name only for buyers (rider privacy). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
