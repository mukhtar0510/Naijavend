// "Heat": what is getting attention on Kwaravend right now, from real signals
// only (no invented numbers). For every listing over the last 14 days:
//   * a listing page view counts 1
//   * a unit ordered (any order that was not cancelled) counts 4
//   * being newly listed counts 1
// and every signal fades by half every 2 days, so this week beats last week.
// A hashtag's heat is the heat of the listings carrying it, plus a small
// baseline for how many listings use it. A tag is "on heat" when most of its
// heat arrived in the last 48 hours.
//
// Views and orders are read with the service role (store_events and orders are
// not public), aggregated here, and only scores leave this module: no buyer,
// order or path is ever returned. Cached for 5 minutes.
import { unstable_cache } from 'next/cache';
import { listingHashtags } from '@idevtenancy/shared';
import { supabaseAnon, supabaseServiceOptional } from '@/lib/supabase';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';

const DAY = 86_400_000;
const WINDOW_DAYS = 14;
const HALF_LIFE_DAYS = 2;
const RECENT_MS = 2 * DAY;

export interface TrendingTag {
  tag: string;
  /** Rounded heat score, for ordering only. */
  heat: number;
  /** Listings carrying the tag. */
  listings: number;
  /** Most of its heat arrived in the last 48 hours. */
  onHeat: boolean;
}

export interface TrendingSnapshot {
  tags: TrendingTag[];
  /** listing id -> heat, only for listings with any signal. */
  listingHeat: Record<string, number>;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function decay(ageMs: number): number {
  return Math.pow(0.5, Math.max(0, ageMs) / (HALF_LIFE_DAYS * DAY));
}

async function computeTrending(): Promise<TrendingSnapshot> {
  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * DAY).toISOString();
  const anon = supabaseAnon();
  const svc = supabaseServiceOptional();

  const { data: listingRows } = await anon
    .from('listings')
    .select('id, title, tags, category, created_at, stores!inner(is_example, category)')
    .in('stores.is_example', LISTED_EXAMPLE_VALUES)
    .limit(3000);
  const listings = ((listingRows ?? []) as unknown as Array<{
    id: string;
    title: string;
    tags: unknown;
    category: string | null;
    created_at: string;
    stores: { category: string } | Array<{ category: string }>;
  }>).map((l) => {
    const store = Array.isArray(l.stores) ? l.stores[0] : l.stores;
    // Own hashtags, or automatic ones from the title and category.
    return { ...l, hashtags: listingHashtags(l.tags, l.title, l.category ?? store?.category) };
  });
  const known = new Set(listings.map((l) => l.id));

  const heat = new Map<string, number>();
  const recent = new Map<string, number>();
  const add = (id: string, amount: number, at: number) => {
    if (!known.has(id) || !Number.isFinite(at)) return;
    const v = amount * decay(now - at);
    heat.set(id, (heat.get(id) ?? 0) + v);
    if (now - at <= RECENT_MS) recent.set(id, (recent.get(id) ?? 0) + v);
  };

  for (const l of listings) {
    const at = Date.parse(l.created_at);
    if (now - at <= WINDOW_DAYS * DAY) add(l.id, 1, at);
  }

  if (svc) {
    const [views, sales] = await Promise.all([
      svc
        .from('store_events')
        .select('path, created_at')
        .eq('event_type', 'listing_view')
        .gte('created_at', since)
        .limit(20000),
      svc
        .from('order_items')
        .select('listing_id, quantity, orders!inner(created_at, status)')
        .gte('orders.created_at', since)
        .neq('orders.status', 'cancelled')
        .limit(10000),
    ]);
    for (const v of (views.data ?? []) as Array<{ path: string | null; created_at: string }>) {
      const m = /\/listing\/([0-9a-f-]{36})/i.exec(v.path ?? '');
      if (m && UUID.test(m[1]!)) add(m[1]!.toLowerCase(), 1, Date.parse(v.created_at));
    }
    for (const s of (sales.data ?? []) as unknown as Array<{
      listing_id: string;
      quantity: number;
      orders: { created_at: string } | Array<{ created_at: string }>;
    }>) {
      const o = Array.isArray(s.orders) ? s.orders[0] : s.orders;
      if (o) add(s.listing_id, 4 * Math.max(1, Number(s.quantity) || 1), Date.parse(o.created_at));
    }
  }

  const tagHeat = new Map<string, { heat: number; recent: number; listings: number }>();
  for (const l of listings) {
    for (const tag of l.hashtags) {
      const cur = tagHeat.get(tag) ?? { heat: 0, recent: 0, listings: 0 };
      cur.heat += heat.get(l.id) ?? 0;
      cur.recent += recent.get(l.id) ?? 0;
      cur.listings += 1;
      tagHeat.set(tag, cur);
    }
  }

  const tags: TrendingTag[] = [...tagHeat.entries()]
    .map(([tag, t]) => ({
      tag,
      heat: Math.round((t.heat + 0.25 * t.listings) * 100) / 100,
      listings: t.listings,
      onHeat: t.heat >= 2 && t.recent / t.heat > 0.5,
    }))
    .sort((a, b) => b.heat - a.heat || b.listings - a.listings || a.tag.localeCompare(b.tag));

  const listingHeat: Record<string, number> = {};
  for (const [id, v] of heat) if (v > 0.01) listingHeat[id] = Math.round(v * 100) / 100;
  return { tags, listingHeat };
}

const cachedTrending = unstable_cache(computeTrending, ['kv-trending-v1'], { revalidate: 300, tags: ['trending'] });

/** The current heat snapshot. Never throws: an empty snapshot on any failure. */
export async function getTrending(): Promise<TrendingSnapshot> {
  try {
    return await cachedTrending();
  } catch (err) {
    console.warn('[trending] failed:', (err as Error).message);
    return { tags: [], listingHeat: {} };
  }
}

/** Order items by heat (hottest first); items with no heat keep their order. */
export function sortByHeat<T>(items: T[], idOf: (t: T) => string, listingHeat: Record<string, number>): T[] {
  return items
    .map((item, i) => ({ item, i, h: listingHeat[idOf(item)] ?? 0 }))
    .sort((a, b) => b.h - a.h || a.i - b.i)
    .map((x) => x.item);
}
