// Admin metrics: platform-wide counts via the service role. Read-only, admin-gated.
import { NextRequest } from 'next/server';
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET(_req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [users, stores, listings, orders, reviews, newUsers24, newStores7, paidOrders, banned] =
    await Promise.all([
      svc.from('users_overview').select('id', { count: 'exact', head: true }),
      svc.from('stores').select('id', { count: 'exact', head: true }),
      svc.from('listings').select('id', { count: 'exact', head: true }),
      svc.from('orders').select('id', { count: 'exact', head: true }),
      svc.from('store_ratings').select('id', { count: 'exact', head: true }),
      svc.from('users_overview').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      svc.from('stores').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      svc.from('orders').select('total_kobo').eq('status', 'paid'),
      svc.from('banned_users').select('id', { count: 'exact', head: true }),
    ]);

  const gmvKobo = (paidOrders.data ?? []).reduce((sum, o) => sum + Number(o.total_kobo ?? 0), 0);

  return apiOk({
    users: users.count ?? 0,
    stores: stores.count ?? 0,
    listings: listings.count ?? 0,
    orders: orders.count ?? 0,
    reviews: reviews.count ?? 0,
    newUsers24h: newUsers24.count ?? 0,
    newStores7d: newStores7.count ?? 0,
    gmvKobo,
    paidOrders: (paidOrders.data ?? []).length,
    banned: banned.count ?? 0,
  });
}
