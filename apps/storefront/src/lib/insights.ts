// Weekly seller insight — the plain-language summary shown on the dashboard.
//
// This module computes the numbers; the model (packages/ai `weekly_insight`)
// only turns them into sentences. Splitting them means the seller always gets
// a summary, keyless, and the numbers it quotes are ones we actually measured.
import type { SupabaseClient } from '@supabase/supabase-js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InsightNumbers {
  thisWeek: { views: number; listingViews: number; orders: number; revenueKobo: number; bookings: number };
  lastWeek: { views: number; listingViews: number; orders: number; revenueKobo: number; bookings: number };
  top: { title: string; units: number; prevUnits: number } | null;
}

export interface InsightResult {
  summary: string;
  points: string[];
  action: string;
  numbers: InsightNumbers;
  source: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Pull two comparable 7-day windows (this week vs the week before) from
 * store_events / orders. Orders that were paid or fulfilled count; cancelled
 * ones never do.
 */
export async function weeklyNumbers(sb: SupabaseClient, storeId: string): Promise<InsightNumbers> {
  const today = startOfDay(new Date());
  const thisFrom = new Date(today.getTime() - 6 * DAY_MS);
  const lastFrom = new Date(today.getTime() - 13 * DAY_MS);
  const lastTo = new Date(today.getTime() - 7 * DAY_MS);

  const [eventsRes, ordersRes, listingIdsRes] = await Promise.all([
    sb.from('store_events')
      .select('event_type, created_at')
      .eq('store_id', storeId)
      .gte('created_at', lastFrom.toISOString())
      .lt('created_at', today.toISOString())
      .limit(10_000),
    sb.from('orders')
      .select('status, total_kobo, created_at')
      .eq('store_id', storeId)
      .gte('created_at', lastFrom.toISOString())
      .lt('created_at', today.toISOString())
      .limit(2000),
    sb.from('listings').select('id, title').eq('store_id', storeId).limit(500),
  ]);

  const events = (eventsRes.data ?? []) as Array<{ event_type: string; created_at: string }>;
  const orders = (ordersRes.data ?? []) as Array<{ status: string; total_kobo: number; created_at: string }>;
  const titles = new Map(
    ((listingIdsRes.data ?? []) as Array<{ id: string; title: string }>).map((l) => [l.id, l.title]),
  );

  const bucket = (from: Date, to: Date) => {
    const seg = events.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    const paid = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= from.getTime() && t < to.getTime() && (o.status === 'paid' || o.status === 'fulfilled');
    });
    return {
      views: seg.filter((e) => e.event_type === 'view' || e.event_type === 'listing_view').length,
      listingViews: seg.filter((e) => e.event_type === 'listing_view').length,
      orders: paid.length,
      revenueKobo: paid.reduce((sum, o) => sum + (Number(o.total_kobo) || 0), 0),
      bookings: 0,
    };
  };

  // Units per listing per window (order_items joined server-side through the
  // inner orders relation — capped at 5000 rows, same order of magnitude as the
  // events query above).
  const unitsFor = async (from: Date, to: Date) => {
    const { data } = await sb
      .from('order_items')
      .select('quantity, listing_id, created_at, orders!inner(store_id, status)')
      .eq('orders.store_id', storeId)
      .in('orders.status', ['paid', 'fulfilled'])
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .limit(5000);
    const map = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ quantity: number; listing_id: string }>) {
      map.set(row.listing_id, (map.get(row.listing_id) ?? 0) + (row.quantity || 1));
    }
    return map;
  };

  const [thisUnits, lastUnits] = await Promise.all([
    unitsFor(thisFrom, new Date(today.getTime() + DAY_MS)),
    unitsFor(lastFrom, lastTo),
  ]);

  let topInsight: InsightNumbers['top'] = null;
  for (const [listingId, units] of thisUnits) {
    const prev = lastUnits.get(listingId) ?? 0;
    if (!topInsight || units > topInsight.units || (units === topInsight.units && prev > topInsight.prevUnits)) {
      topInsight = {
        title: titles.get(listingId) ?? 'Your top listing',
        units,
        prevUnits: prev,
      };
    }
  }

  return {
    thisWeek: bucket(thisFrom, new Date(today.getTime() + DAY_MS)),
    lastWeek: bucket(lastFrom, lastTo),
    top: topInsight && topInsight.units > 0 ? topInsight : null,
  };
}

/** Compact one-line encoding of the numbers for the model's `[Stats]` tag. */
export function statsLine(n: InsightNumbers): string {
  const revenue = (v: number) => Math.round(v / 100);
  return [
    `views ${n.thisWeek.views} vs ${n.lastWeek.views}`,
    `orders ${n.thisWeek.orders} vs ${n.lastWeek.orders}`,
    `revenue ${revenue(n.thisWeek.revenueKobo)} vs ${revenue(n.lastWeek.revenueKobo)}`,
  ].join(' | ');
}

/**
 * Backgrounded summary: the page renders immediately with the raw numbers, and
 * the model's wording arrives through a client-side fetch so a slow Gemini call
 * never blocks the analytics dashboard.
 */
export function insightInput(n: InsightNumbers, storeName: string): string {
  const top = n.top
    ? `[Top] ${n.top.title} — ${n.top.units} sold this week vs ${n.top.prevUnits} last week`
    : '[Top] none';
  return [
    `[Store] ${storeName}`,
    `[Stats] ${statsLine(n)}`,
    top,
    `[Note] bookings ${n.thisWeek.bookings} vs ${n.lastWeek.bookings}`,
  ].join('\n');
}