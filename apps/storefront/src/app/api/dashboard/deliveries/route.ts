// Seller dispatch actions (T09). Ownership is checked with the seller's own
// session (RLS: deliveries are read-only for owners); writes then go through
// the service role so every rule in lib/delivery.ts applies.
//   { action: 'create', orderId }
//   { action: 'assign', deliveryId, riderId | null, eta? }
//   { action: 'status', deliveryId, next, note?, reason?, otp?, sellerConfirm? }
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { applyStatus, ensureDelivery, isStatus, newToken, type DeliveryStatus } from '@/lib/delivery';
import { planLocked, PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const rl = rateLimit(`deliveries:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many changes. Wait a moment.');
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const action = sanitizeText(b.action, 12);

  try {
    const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
    if (!store) return apiError(403, 'no_store', 'Only the store owner can dispatch.');
    const locked = planLocked(store, 'dispatch');
    if (locked) return locked;
    const svc = supabaseService();

    if (action === 'create') {
      const orderId = sanitizeText(b.orderId, 40);
      if (!UUID.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');
      const { data: order } = await sb.from('orders').select('id, store_id, status').eq('id', orderId).eq('store_id', store.id).maybeSingle();
      if (!order) return apiError(404, 'order_not_found', 'Order not found.');
      if (order.status === 'cancelled') return apiError(409, 'cancelled', 'This order was cancelled.');
      const d = await ensureDelivery(svc, order);
      if (!d) return apiError(500, 'create_failed', 'Could not create the delivery. Is the delivery migration applied?');
      return apiOk({ id: d.id, trackingToken: d.tracking_token }, 201);
    }

    const deliveryId = sanitizeText(b.deliveryId, 40);
    if (!UUID.test(deliveryId)) return apiError(400, 'invalid_delivery', 'Invalid delivery.');
    // RLS: returns a row only if this seller owns it.
    const { data: delivery } = await sb
      .from('deliveries')
      .select('id, status, order_id, rider_id, store_id')
      .eq('id', deliveryId)
      .maybeSingle();
    if (!delivery || delivery.store_id !== store.id) return apiError(404, 'delivery_not_found', 'Delivery not found.');

    if (action === 'assign') {
      const riderId = b.riderId == null || b.riderId === '' ? null : sanitizeText(b.riderId, 40);
      const eta = sanitizeText(b.eta, 60);
      if (riderId) {
        if (!UUID.test(riderId)) return apiError(400, 'invalid_rider', 'Invalid rider.');
        const { data: rider } = await sb.from('riders').select('id, active').eq('id', riderId).eq('store_id', store.id).maybeSingle();
        if (!rider) return apiError(404, 'rider_not_found', 'Rider not found.');
        if (!rider.active) return apiError(409, 'rider_inactive', 'That rider is switched off. Turn them on in Riders first.');
      }
      if (!['awaiting_dispatch', 'assigned', 'failed_attempt'].includes(delivery.status)) {
        return apiError(409, 'in_progress', 'The rider already has this order. Mark it failed or returned to change rider.');
      }
      // A new rider gets a fresh private link; the old one stops working.
      const { error } = await svc
        .from('deliveries')
        .update({ rider_id: riderId, rider_token: riderId ? newToken() : null, ...(eta ? { eta_window: eta } : {}), updated_at: new Date().toISOString() })
        .eq('id', delivery.id);
      if (error) return apiError(500, 'assign_failed', 'Could not assign. Try again.');
      if (riderId && delivery.status !== 'assigned') {
        const r = await applyStatus(svc, { ...delivery, rider_id: riderId } as never, 'assigned', { actor: 'seller', note: eta ? `Expected ${eta}` : '' });
        if (!r.ok) return apiError(409, r.code, r.message);
      }
      if (!riderId && delivery.status === 'assigned') {
        await applyStatus(svc, delivery as never, 'awaiting_dispatch', { actor: 'seller', note: 'Rider unassigned' });
      }
      return apiOk({ updated: true });
    }

    if (action === 'status') {
      const next = sanitizeText(b.next, 24);
      if (!isStatus(next)) return apiError(422, 'invalid_status', 'Unknown status.');
      const r = await applyStatus(svc, delivery as { id: string; status: DeliveryStatus; order_id: string; rider_id: string | null }, next, {
        actor: 'seller',
        note: sanitizeText(b.note, 200),
        reason: sanitizeText(b.reason, 160),
        otp: sanitizeText(b.otp, 8),
        sellerConfirm: b.sellerConfirm === true,
      });
      if (!r.ok) return apiError(409, r.code, r.message);
      return apiOk({ updated: true });
    }

    return apiError(422, 'invalid_action', 'Unknown action.');
  } catch (err) {
    return internalError('deliveries', err);
  }
}
