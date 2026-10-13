// Alerts inbox — list + mark-read for the signed-in buyer. RLS scopes rows to
// auth.uid(); unread count powers the bell badge in the account nav.
import { NextRequest } from 'next/server';
import { getCustomerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const rl = rateLimit(`alerts-get:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many requests — try again shortly.');

  const sb = await getCustomerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in to see your alerts.');

  try {
    const [{ data: alerts, error }, { count: unread }] = await Promise.all([
      sb
        .from('alerts')
        .select('id, kind, title, body, href, read_at, created_at, store_id, listing_id')
        .order('created_at', { ascending: false })
        .limit(50),
      sb.from('alerts').select('id', { count: 'exact', head: true }).is('read_at', null),
    ]);
    if (error) throw error;
    return apiOk({ alerts: alerts ?? [], unread: unread ?? 0 });
  } catch (err) {
    return internalError('alerts/get', err);
  }
}

/** POST { ids?: string[], all?: true } — mark alerts read. */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`alerts-read:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many requests — try again shortly.');

  const sb = await getCustomerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const all = b.all === true;
  const ids = Array.isArray(b.ids)
    ? b.ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50)
    : [];
  if (!all && ids.length === 0) return apiError(400, 'no_targets', 'Nothing to mark as read.');

  try {
    let query = sb.from('alerts').update({ read_at: new Date().toISOString() }).is('read_at', null);
    query = all ? query : query.in('id', ids);
    const { error } = await query;
    if (error) throw error;
    return apiOk({ ok: true });
  } catch (err) {
    return internalError('alerts/read', err);
  }
}
