// Kwaravend rider requests (plan add-on, 23 Nov 2026). A seller on Business
// or Emirates Plus with the rider add-on paid asks Kwaravend for a rider; the
// owner assigns one in /admin → Riders.
//   GET                                   this store's requests
//   POST { orderId?, speed, pickup, dropoff, note }   request a rider
//   POST { action: 'cancel', id }         cancel before pickup
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { effectivePlan, riderActive, riderSpeeds } from '@/lib/plans';
import { planLocked, PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET() {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
  if (!store) return apiError(403, 'no_store', 'Only the store owner can do this.');
  const { data, error } = await sb
    .from('rider_requests')
    .select('id, delivery_id, speed, pickup, dropoff, note, status, rider_name, rider_phone, admin_note, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return internalError('rider-requests', error);
  return apiOk({ requests: data ?? [], active: riderActive(store), speeds: riderSpeeds(effectivePlan(store)) });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`rider-req:${clientIp(req)}`, 12, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many requests. Wait a minute.');
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
    if (!store) return apiError(403, 'no_store', 'Only the store owner can do this.');
    const svc = supabaseService();

    if (b.action === 'cancel') {
      const id = sanitizeText(b.id, 40);
      if (!UUID.test(id)) return apiError(400, 'invalid', 'Invalid request.');
      const { error } = await svc
        .from('rider_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('store_id', store.id)
        .in('status', ['requested', 'assigned']);
      if (error) throw error;
      return apiOk({ cancelled: true });
    }

    const locked = planLocked(store, 'kwaravend_rider');
    if (locked) return locked;
    if (!riderActive(store)) {
      return apiError(403, 'rider_addon_required', 'Add the Kwaravend rider to your plan first (Plan → add rider).');
    }
    const speeds = riderSpeeds(effectivePlan(store));
    const speed = sanitizeText(b.speed, 12) as 'standard' | 'express' | 'same_day';
    if (!speeds.includes(speed)) return apiError(422, 'invalid_speed', `Your plan can request: ${speeds.join(', ').replace('_', '-')}.`);

    let pickup = sanitizeText(b.pickup, 300);
    let dropoff = sanitizeText(b.dropoff, 300);
    const note = sanitizeText(b.note, 300);
    let deliveryId: string | null = null;
    let orderId: string | null = null;
    if (typeof b.orderId === 'string' && UUID.test(b.orderId)) {
      const { data: o } = await svc
        .from('orders')
        .select('id, customer_name, customer_phone, delivery_address, delivery_landmark, delivery_area')
        .eq('id', b.orderId)
        .eq('store_id', store.id)
        .maybeSingle();
      if (!o) return apiError(404, 'no_order', 'Order not found.');
      orderId = o.id as string;
      if (!dropoff) dropoff = [o.delivery_address, o.delivery_landmark, o.delivery_area, o.customer_name, o.customer_phone].filter(Boolean).join(', ');
      const { data: d } = await svc.from('deliveries').select('id').eq('order_id', orderId).maybeSingle();
      deliveryId = (d?.id as string | undefined) ?? null;
      if (deliveryId) {
        const { data: open } = await svc.from('rider_requests').select('id').eq('delivery_id', deliveryId).in('status', ['requested', 'assigned', 'picked_up']).maybeSingle();
        if (open) return apiError(409, 'already_requested', 'A Kwaravend rider is already on this delivery.');
      }
    }
    if (!pickup) {
      const { data: s } = await svc.from('stores').select('address').eq('id', store.id).maybeSingle();
      pickup = sanitizeText(s?.address, 300);
    }
    if (pickup.length < 3 || dropoff.length < 3) return apiError(422, 'missing_address', 'Add the pickup and drop-off addresses.');

    const { data, error } = await svc
      .from('rider_requests')
      .insert({ store_id: store.id, delivery_id: deliveryId, speed, pickup, dropoff, note: orderId && !note ? `Order ${orderId.slice(0, 8).toUpperCase()}` : note })
      .select('id, status')
      .single();
    if (error) throw error;
    return apiOk({ request: data }, 201);
  } catch (err) {
    return internalError('rider-requests', err);
  }
}
