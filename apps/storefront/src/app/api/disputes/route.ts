// Disputes — buyer side. A signed-in buyer opens a dispute on their own order;
// RLS (disputes customer insert) double-checks that the order belongs to them.
// One OPEN dispute per order is enforced by a partial unique index in the DB.
import { NextRequest } from 'next/server';
import { getCustomerClient, getCustomerUser } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

const REASONS = new Set([
  'not_received', 'wrong_item', 'damaged', 'defective', 'fake', 'refund_request', 'other',
]);

export async function POST(req: NextRequest) {
  const rl = rateLimit(`dispute-open:${clientIp(req)}`, 5, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many reports. Try again in ${rl.retryAfterSeconds}s.`);

  const customer = await getCustomerUser();
  const sb = await getCustomerClient();
  if (!customer || !sb) return apiError(401, 'unauthenticated', 'Sign in to report a problem with your order.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const orderId = sanitizeText(b.orderId, 40);
  const reason = sanitizeText(b.reason, 30);
  const message = sanitizeText(b.message, 1000);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');
  if (!REASONS.has(reason)) return apiError(422, 'invalid_reason', 'Pick what went wrong with this order.');
  if (reason !== 'other' && message.length === 0) {
    // 'other' needs a description too — everything does, really, but keep the
    // required-field error on the reason people actually fill in.
    return apiError(422, 'empty_message', 'Tell us what happened (at least 10 characters).');
  }
  if (message.length > 0 && message.length < 10) {
    return apiError(422, 'message_too_short', 'Add a little more detail (at least 10 characters).');
  }

  try {
    // RLS scopes this read to the buyer's own orders — someone else's order id
    // simply returns null, which we answer as 404 (no existence leak beyond
    // what an order uuid already implies).
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .select('id, store_id, customer_phone, status, total_kobo')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return apiError(404, 'order_not_found', 'Order not found (or not yours).');

    if (order.status === 'pending') {
      return apiError(409, 'not_paid', 'This order has not been paid yet — cancel it from the order page instead.');
    }
    if (order.status === 'refunded') {
      return apiError(409, 'already_refunded', 'This order has already been refunded.');
    }

    const { data, error } = await sb
      .from('disputes')
      .insert({
        order_id: order.id,
        store_id: order.store_id,
        customer_id: customer.id,
        reporter_phone: order.customer_phone ?? '',
        reason,
        message,
      })
      .select('id, status, created_at')
      .single();
    if (error) {
      // 23505 = the one-open-dispute-per-order partial unique index.
      if (error.code === '23505') {
        return apiError(409, 'already_reported', 'You already have an open report on this order — the store is working on it.');
      }
      throw error;
    }
    return apiOk({ dispute: data }, 201);
  } catch (err) {
    return internalError('disputes/create', err);
  }
}

/** GET ?orderId= — the buyer's dispute for one of their orders (if any). */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');

  const sb = await getCustomerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  try {
    const { data, error } = await sb
      .from('disputes')
      .select('id, reason, message, status, seller_note, refund_kobo, created_at, updated_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return apiOk({ dispute: data?.[0] ?? null });
  } catch (err) {
    return internalError('disputes/get', err);
  }
}
