// Store detail analytics + actions: verify/unverify (POST) and a rich
// per-store stats read (GET) — visits, event breakdown, orders, GMV.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

interface Ctx {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;
  const storeId = params.id;

  const { data: store } = await svc
    .from('stores')
    .select('id, name, slug, category, business_type, verification_status, is_dropshipper, created_at, address, owner_id, store_rating_stats(review_count, avg_stars)')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return apiError(404, 'not_found', 'Store not found.');

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const [visitsAll, visits30, listingViews, shares, chats, listings, orders, ratings] = await Promise.all([
    svc.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('event_type', 'view'),
    svc.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('event_type', 'view').gte('created_at', since30),
    svc.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('event_type', 'listing_view'),
    svc.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('event_type', 'share'),
    svc.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('event_type', 'chat_started'),
    svc.from('listings').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
    svc.from('orders').select('status, total_kobo, created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(500),
    svc.from('store_ratings').select('stars, comment, created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(10),
  ]);

  const orderRows = orders.data ?? [];
  const gmvKobo = orderRows.filter((o) => o.status === 'paid' || o.status === 'fulfilled').reduce((s, o) => s + Number(o.total_kobo ?? 0), 0);
  const statusCounts: Record<string, number> = {};
  for (const o of orderRows) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  // Visits per day, last 14 days (sparkline source).
  const visitDays: Array<{ day: string; visits: number }> = [];
  for (let i = 13; i >= 0; i--) visitDays.push({ day: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), visits: 0 });
  const { data: visitRows } = await svc
    .from('store_events')
    .select('created_at')
    .eq('store_id', storeId)
    .eq('event_type', 'view')
    .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString());
  const visitByDay = new Map(visitDays.map((d) => [d.day, d]));
  for (const v of visitRows ?? []) {
    const bucket = visitByDay.get((v.created_at ?? '').slice(0, 10));
    if (bucket) bucket.visits += 1;
  }

  const stats = Array.isArray(store.store_rating_stats) ? store.store_rating_stats[0] : store.store_rating_stats;
  const { store_rating_stats: _drop, ...storeRest } = store as Record<string, unknown>;

  return apiOk({
    store: {
      ...storeRest,
      review_count: (stats as { review_count?: number } | null)?.review_count ?? 0,
      avg_stars: (stats as { avg_stars?: number } | null)?.avg_stars ?? null,
    },
    stats: {
      visitsAll: visitsAll.count ?? 0,
      visits30d: visits30.count ?? 0,
      listingViews: listingViews.count ?? 0,
      shares: shares.count ?? 0,
      chatsStarted: chats.count ?? 0,
      listings: listings.count ?? 0,
      ordersTotal: orderRows.length,
      ordersByStatus: statusCounts,
      gmvKobo,
      visitDays,
      recentReviews: ratings.data ?? [],
    },
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc, email: actorEmail } = actor;

  let action = '';
  try {
    const body = await req.json();
    action = typeof body.action === 'string' ? body.action : '';
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  if (action !== 'verify' && action !== 'unverify') {
    return apiError(400, 'bad_action', 'action must be verify or unverify.');
  }

  const { data: existing } = await svc
    .from('stores')
    .select('id, name, verification_status')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return apiError(404, 'not_found', 'Store not found.');

  const status = action === 'verify' ? 'verified' : 'unverified';
  const { error } = await svc
    .from('stores')
    .update({ verification_status: status, verified_at: action === 'verify' ? new Date().toISOString() : null })
    .eq('id', params.id);
  if (error) return apiError(500, 'update_failed', error.message);

  await audit(actorEmail, action, { userId: params.id }, { store: existing.name });
  return apiOk({ ok: true, action, status });
}
