// Follow / unfollow a store (server-side). The follow list drives the alerts
// inbox: new listings and price drops fan out from DB triggers on `listings`.
import { NextRequest } from 'next/server';
import { getCustomerClient, getCustomerUser } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

// Initial state for the follow button: is the signed-in customer following this store?
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');

  const customer = await getCustomerUser();
  const sb = await getCustomerClient();
  if (!customer || !sb) return apiOk({ following: false });

  try {
    const { data, error } = await sb
      .from('store_follows')
      .select('store_id')
      .eq('customer_id', customer.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw error;
    return apiOk({ following: Boolean(data) });
  } catch (err) {
    return internalError('follow-get', err);
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`follow:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Slow down. Try again in ${rl.retryAfterSeconds}s.`);

  const customer = await getCustomerUser();
  const sb = await getCustomerClient();
  if (!customer || !sb) return apiError(401, 'unauthenticated', 'Sign in to follow this store.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const storeId = sanitizeText(b.storeId, 40);
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');

  try {
    const { data: store } = await sb.from('stores').select('id').eq('id', storeId).maybeSingle();
    if (!store) return apiError(404, 'store_not_found', 'Store not found.');

    const { data: existing, error: findErr } = await sb
      .from('store_follows')
      .select('store_id')
      .eq('customer_id', customer.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
      const { error: delErr } = await sb
        .from('store_follows')
        .delete()
        .eq('customer_id', customer.id)
        .eq('store_id', storeId);
      if (delErr) throw delErr;
      return apiOk({ following: false });
    }

    const { error: insErr } = await sb
      .from('store_follows')
      .insert({ customer_id: customer.id, store_id: storeId });
    if (insErr) {
      // 23505 = a concurrent double-tap already followed — idempotent success.
      if (insErr.code === '23505') return apiOk({ following: true });
      throw insErr;
    }
    return apiOk({ following: true });
  } catch (err) {
    return internalError('follow', err);
  }
}
