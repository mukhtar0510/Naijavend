// Admin users directory: every account across auth.users via the users_overview
// view, with the ban state joined. Admin-gated, service-role read.
import { NextRequest } from 'next/server';
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const role = req.nextUrl.searchParams.get('role') ?? 'all';

  let query = svc
    .from('users_overview')
    .select('id, email, created_at, last_sign_in_at, banned_until, role, store_name, store_slug, order_count, review_count')
    .order('created_at', { ascending: false })
    .limit(500);

  if (q) query = query.ilike('email', `%${q}%`);
  if (role === 'seller' || role === 'customer') query = query.eq('role', role);

  const { data, error } = await query;
  if (error) return apiError(500, 'query_failed', error.message);

  const { data: banned } = await svc.from('banned_users').select('user_id, reason, banned_at');

  const bannedMap = new Map((banned ?? []).map((b) => [b.user_id, b]));
  const users = (data ?? []).map((u) => ({
    ...u,
    banned: bannedMap.has(u.id) || (!!u.banned_until && new Date(u.banned_until) > new Date()),
    ban_reason: bannedMap.get(u.id)?.reason ?? null,
  }));

  return apiOk({ users });
}
