// Admin metrics: platform-wide counts + chart-ready breakdowns via the
// service role. Read-only, admin-gated.
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // MRR window: 6 full months + the current month.
  const mrrStart = new Date();
  mrrStart.setMonth(mrrStart.getMonth() - 6, 1);
  mrrStart.setHours(0, 0, 0, 0);

  // Growth plan list price per store per month (kobo) — the platform's
  // recurring revenue unit. Stores created on/after a month count from that
  // month (first full month billed at activation).
  const GROWTH_MONTHLY_KOBO = 50_000; // ₦500/mo placeholder price

  // Onboarding funnel: last 30 days of tracked events, aggregated client-side below.
  const funnelStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [users, stores, listings, orders, reviews, newUsers24, newStores7, paidOrders, banned, storeRows, orderRows, userRows, mrrStoreRows, funnelRows, newStores30] =
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
      svc.from('stores').select('category'),
      svc.from('orders').select('status, total_kobo, created_at'),
      svc.from('users_overview').select('created_at, role'),
      svc.from('stores').select('plan, created_at').gte('created_at', mrrStart.toISOString()),
      svc
        .from('onboarding_funnel_events')
        .select('user_id, event, step, label')
        .gte('created_at', funnelStart)
        .limit(20_000),
      svc.from('stores').select('owner_id, created_at').gte('created_at', funnelStart),
    ]);

  // ---- Onboarding funnel (30d) ----
  // Sessions = distinct users who saw any step. Step reach = distinct users who
  // viewed each step. Publishes = stores created in the window (funnel end).
  const fRows = (funnelRows.data ?? []) as Array<{ user_id: string; event: string; step: number | null; label: string | null }>;
  const stepViewers = new Map<number, Set<string>>();
  const stepCompleters = new Map<number, Set<string>>();
  const usersAny = new Set<string>();
  const chipCounts = new Map<string, number>();
  const previewUsers = new Set<string>();
  for (const r of fRows) {
    if (r.event === 'step_view' && r.step) {
      usersAny.add(r.user_id);
      (stepViewers.get(r.step) ?? stepViewers.set(r.step, new Set()).get(r.step)!).add(r.user_id);
    }
    if (r.event === 'step_complete' && r.step) {
      (stepCompleters.get(r.step) ?? stepCompleters.set(r.step, new Set()).get(r.step)!).add(r.user_id);
    }
    if (r.event === 'chip_add' && r.label) chipCounts.set(r.label, (chipCounts.get(r.label) ?? 0) + 1);
    if (r.event === 'preview_shown') previewUsers.add(r.user_id);
  }
  const newStoresByOwner = new Set(((newStores30.data ?? []) as Array<{ owner_id: string }>).map((s) => s.owner_id));
  const published = [...newStoresByOwner].filter((uid) => usersAny.has(uid)).length;
  const abandoned = [...usersAny].filter((uid) => !newStoresByOwner.has(uid)).length;
  const funnel = {
    entered: usersAny.size,
    reachedStep2: (stepViewers.get(2) ?? new Set()).size,
    reachedStep3: (stepViewers.get(3) ?? new Set()).size,
    published,
    abandoned,
    previewShown: previewUsers.size,
    topChips: Array.from(chipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value })),
  };

  const gmvKobo = (paidOrders.data ?? []).reduce((sum, o) => sum + Number(o.total_kobo ?? 0), 0);

  // Stores by category.
  const catCounts = new Map<string, number>();
  for (const s of storeRows.data ?? []) {
    const c = s.category || 'other';
    catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }
  const categories = Array.from(catCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Orders by status.
  const statusCounts = new Map<string, number>();
  for (const o of orderRows.data ?? []) {
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  }
  const ordersByStatus = Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value }));

  // Signups per day, last 14 days.
  const days: Array<{ day: string; sellers: number; customers: number }> = [];
  for (let i = 13; i >= 0; i--) {
    days.push({ day: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), sellers: 0, customers: 0 });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const u of userRows.data ?? []) {
    const bucket = byDay.get((u.created_at ?? '').slice(0, 10));
    if (bucket) {
      if (u.role === 'seller') bucket.sellers += 1;
      else bucket.customers += 1;
    }
  }

  // Paid revenue per day, last 30 days (GMV trend).
  const revDays: Array<{ day: string; kobo: number }> = [];
  for (let i = 29; i >= 0; i--) {
    revDays.push({ day: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), kobo: 0 });
  }
  const revByDay = new Map(revDays.map((d) => [d.day, d]));
  for (const o of orderRows.data ?? []) {
    if (o.status !== 'paid' && o.status !== 'fulfilled') continue;
    const bucket = revByDay.get((o.created_at ?? '').slice(0, 10));
    if (bucket) bucket.kobo += Number(o.total_kobo ?? 0);
  }

  // MRR: growth-plan stores × list price, bucketed by month. A store counts
  // from the first month boundary after its creation (activation month).
  const months: Array<{ month: string; label: string; mrrKobo: number; stores: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    months.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-NG', { month: 'short' }),
      mrrKobo: 0,
      stores: 0,
    });
  }
  const monthByKey = new Map(months.map((m) => [m.month, m]));
  for (const s of mrrStoreRows.data ?? []) {
    if (s.plan !== 'growth') continue;
    const created = new Date(s.created_at);
    // First full month: the month after signup (activation), clamped to the window.
    const first = new Date(created.getFullYear(), created.getMonth() + 1, 1);
    const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthByKey.get(key);
    if (bucket) {
      bucket.mrrKobo += GROWTH_MONTHLY_KOBO;
      bucket.stores += 1;
    }
  }
  const currentMrrKobo = months[months.length - 1]?.mrrKobo ?? 0;
  const growthStores = (mrrStoreRows.data ?? []).filter((s) => s.plan === 'growth').length;

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
    categories,
    ordersByStatus,
    signups14d: days,
    revenue30d: revDays,
    mrr: { currentKobo: currentMrrKobo, growthStores, months },
    funnel,
  });
}
