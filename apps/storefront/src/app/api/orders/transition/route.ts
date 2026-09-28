// Order status transitions for sellers. Sellers may: pending -> cancelled,
// paid -> fulfilled, paid -> cancelled. Marking an order 'paid' is rejected here AND by
// the guard_order_status_transition DB trigger — payment status only comes from the
// payment webhook path.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

const ALLOWED: Record<string, string[]> = {
  fulfilled: ['paid'],
  cancelled: ['pending', 'paid'],
};

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const orderId = sanitizeText(b.orderId, 40);
  const next = sanitizeText(b.next, 20);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');
  if (!(next in ALLOWED)) return apiError(422, 'invalid_transition', 'Unsupported status change.');

  try {
    const { data: order } = await sb.from('orders').select('id, status').eq('id', orderId).maybeSingle();
    if (!order) return apiError(404, 'order_not_found', 'Order not found (or not yours).');
    if (next === 'paid' || !(ALLOWED[next] as string[]).includes(order.status)) {
      return apiError(409, 'invalid_transition', `Can't move an order from ${order.status} to ${next}.`);
    }

    const { error } = await sb.from('orders').update({ status: next }).eq('id', orderId).eq('status', order.status);
    if (error) {
      // The DB trigger is the authority; surface its rejection cleanly.
      return apiError(409, 'transition_rejected', 'The system rejected this status change.');
    }
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('orders-transition', err);
  }
}
