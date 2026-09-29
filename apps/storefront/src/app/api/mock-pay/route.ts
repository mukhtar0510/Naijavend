// mock-pay — stand-in for the Paystack webhook (blueprint §4: payment-webhook).
// This is the ONLY path allowed to set orders.status = 'paid'. In production:
//   1. Verify the Paystack signature header (x-paystack-signature HMAC-SHA512 with secret key).
//   2. Idempotently process the charge.success event.
// The trigger in supabase/migrations/20260911000004_order_status_webhook_only.sql enforces
// at the DB level that authenticated sellers can never mark an order paid themselves.
//
// This route previously accepted ANY orderId from ANY caller (it runs with the
// service role, so the DB trigger never fires) — anyone could mark any pending
// order paid, and sellers could self-mark orders to unlock "verified buyer"
// reviews. Now the caller must present the HMAC payment token minted by
// create-order for that exact order.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { verifyPayToken } from '@/lib/paytoken';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`mock-pay:${clientIp(req)}`, 15, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const orderId = b.orderId;
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return apiError(400, 'invalid_order', 'Invalid order reference.');
  }
  const payToken = typeof b.payToken === 'string' ? b.payToken : '';
  if (!verifyPayToken(orderId, payToken)) {
    return apiError(403, 'bad_pay_token', 'This payment link is not valid. Start a new order.');
  }

  try {
    const sb = supabaseService();

    const { data: order, error: fetchErr } = await sb
      .from('orders')
      .select('id, status, total_kobo')
      .eq('id', orderId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!order) return apiError(404, 'order_not_found', 'Order not found.');
    if (order.status === 'paid') return apiOk({ alreadyPaid: true }); // idempotent replay
    if (order.status !== 'pending') {
      return apiError(409, 'not_payable', `This order is ${order.status} and can no longer be paid.`);
    }

    // Fake payment reference shaped like a Paystack reference.
    const reference = `MOCK-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 8)}`;

    const { error: updateErr } = await sb
      .from('orders')
      .update({ status: 'paid', payment_reference: reference })
      .eq('id', orderId)
      .eq('status', 'pending'); // guard against races
    if (updateErr) throw updateErr;

    return apiOk({ paid: true, reference });
  } catch (err) {
    return internalError('mock-pay', err);
  }
}
