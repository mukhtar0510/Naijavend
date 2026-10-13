// Report a store — available from any store page footer. Signed-in buyers only
// (RLS requires reporter_id = auth.uid()); reports land in store_reports where
// the store owner can see and close them.
import { NextRequest } from 'next/server';
import { getCustomerClient, getCustomerUser } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

const REASONS = new Set(['scam', 'fake_goods', 'no_response', 'wrong_product', 'abuse', 'other']);

export async function POST(req: NextRequest) {
  const rl = rateLimit(`store-report:${clientIp(req)}`, 3, 600_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `You can file another report in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).`);

  const customer = await getCustomerUser();
  const sb = await getCustomerClient();
  if (!customer || !sb) return apiError(401, 'unauthenticated', 'Sign in to report a store.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const storeId = sanitizeText(b.storeId, 40);
  const reason = sanitizeText(b.reason, 30);
  const message = sanitizeText(b.message, 1000);

  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');
  if (!REASONS.has(reason)) return apiError(422, 'invalid_reason', 'Pick a reason for the report.');
  if (message.length < 10) return apiError(422, 'message_too_short', 'Tell us what happened (at least 10 characters).');

  try {
    // Public-read policy lets us confirm the store exists before inserting.
    const { data: store } = await sb.from('stores').select('id').eq('id', storeId).maybeSingle();
    if (!store) return apiError(404, 'store_not_found', 'Store not found.');

    const { data, error } = await sb
      .from('store_reports')
      .insert({ store_id: storeId, reporter_id: customer.id, reason, message })
      .select('id, status, created_at')
      .single();
    if (error) throw error;
    return apiOk({ report: data }, 201);
  } catch (err) {
    return internalError('store-report', err);
  }
}
