// Platform analytics for the superadmin console: 30-day activity series plus
// the stores driving the most revenue. Aggregation happens in Postgres
// (platform_activity_daily); only the top-store roll-up is folded here, over a
// bounded set of paid orders.
import { NextRequest } from 'next/server';
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

interface DailyRow {
  day: string;
  new_accounts: number;
  new_stores: number;
  paid_orders: number;
  revenue_kobo: number;
}

export async function GET(_req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [dailyRes, ordersRes, storesRes] = await Promise.all([
    svc
      .from('platform_activity_daily')
      .select('day, new_accounts, new_stores, paid_orders, revenue_kobo')
      .order('day', { ascending: true }),
    svc
      .from('orders')
      .select('store_id, total_kobo')
      .in('status', ['paid', 'fulfilled'])
      .gte('created_at', since)
      .limit(5000),
    svc.from('stores').select('id, name, slug').limit(2000),
  ]);

  if (dailyRes.error) return apiError(500, 'query_failed', dailyRes.error.message);

  const daily = (dailyRes.data ?? []) as DailyRow[];
  const totals = daily.reduce(
    (acc, row) => ({
      newAccounts: acc.newAccounts + Number(row.new_accounts),
      newStores: acc.newStores + Number(row.new_stores),
      paidOrders: acc.paidOrders + Number(row.paid_orders),
      revenueKobo: acc.revenueKobo + Number(row.revenue_kobo),
    }),
    { newAccounts: 0, newStores: 0, paidOrders: 0, revenueKobo: 0 },
  );

  // Top stores by 30-day revenue.
  const storeNames = new Map((storesRes.data ?? []).map((s) => [s.id, s as { id: string; name: string; slug: string }]));
  const byStore = new Map<string, { revenueKobo: number; orders: number }>();
  for (const order of ordersRes.data ?? []) {
    const row = order as { store_id: string; total_kobo: number };
    const entry = byStore.get(row.store_id) ?? { revenueKobo: 0, orders: 0 };
    entry.revenueKobo += Number(row.total_kobo ?? 0);
    entry.orders += 1;
    byStore.set(row.store_id, entry);
  }

  const topStores = [...byStore.entries()]
    .map(([storeId, stats]) => {
      const known = storeNames.get(storeId);
      return {
        id: storeId,
        name: known?.name ?? 'Unknown store',
        slug: known?.slug ?? '',
        revenueKobo: stats.revenueKobo,
        orders: stats.orders,
      };
    })
    .sort((a, b) => b.revenueKobo - a.revenueKobo)
    .slice(0, 8);

  return apiOk({ daily, totals, topStores });
}
