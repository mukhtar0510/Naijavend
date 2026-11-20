// T04: a seller confirms money actually arrived (cash, transfer, pickup).
// The DB function checks store ownership itself, so a forged order id fails there
// rather than here. No gateway is involved — nothing is charged by this route.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { ALL_PAYMENT_METHODS } from '@/lib/payments';

const ALLOWED = new Set<string>(ALL_PAYMENT_METHODS);

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
  const method = sanitizeText(b.method, 24);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');
  if (method && !ALLOWED.has(method)) return apiError(422, 'invalid_method', 'Unknown payment method.');

  try {
    const { error } = await sb.rpc('confirm_order_payment', {
      p_order_id: orderId,
      p_method: method || null,
    });
    if (error) {
      // Missing function = migration not applied yet. Say so plainly instead of
      // pretending the confirmation worked.
      const notReady = /does not exist|schema cache/i.test(error.message);
      return apiError(
        notReady ? 503 : 409,
        notReady ? 'migration_pending' : 'confirm_failed',
        notReady
          ? 'Payment confirmation is not enabled on this database yet.'
          : 'Could not confirm that payment.'
      );
    }
    return apiOk({ confirmed: true });
  } catch (err) {
    return internalError('orders-payment', err);
  }
}
