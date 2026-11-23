// Hashtags on listings (listings.tags, jsonb array of normalised tags). Sellers
// type them or let the AI suggest them in the listing editor; buyers tap one to
// see every listing with it, ranked by what actually sells. Public columns only,
// read with the anon key so RLS decides visibility.
import { normaliseHashtag } from '@idevtenancy/shared';
import { supabaseAnon } from '@/lib/supabase';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';

export interface TaggedListing {
  id: string;
  title: string;
  priceKobo: number;
  compareAtKobo: number | null;
  stock: number | null;
  type: string;
  cover: string | null;
  hasVideo: boolean;
  storeName: string;
  storeSlug: string;
  isExample: boolean;
  /** Units sold in paid or fulfilled orders (from the trending_products view). */
  sold: number;
  tags: string[];
  createdAt: string;
}

const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 1000;

/**
 * Every listing carrying `#tag`, best sellers first, then newest.
 * Returns the normalised tag too, so "/tags/Ankara" can redirect to "/tags/ankara".
 */
export async function fetchTaggedListings(raw: string, limit = 60): Promise<{ tag: string; items: TaggedListing[] }> {
  const tag = normaliseHashtag(raw);
  if (!tag) return { tag: '', items: [] };
  const sb = supabaseAnon();
  const { data, error } = await sb
    .from('listings')
    .select('id, title, price_kobo, compare_at_kobo, stock, type, image_urls, video_url, tags, created_at, stores!inner(name, slug, is_example)')
    // tags is jsonb, so the containment value must be JSON (cs.["tag"]), not a Postgres array.
    .filter('tags', 'cs', JSON.stringify([tag]))
    .in('stores.is_example', LISTED_EXAMPLE_VALUES)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  type Row = {
    id: string;
    title: string;
    price_kobo: number;
    compare_at_kobo: number | null;
    stock: number | null;
    type: string;
    image_urls: unknown;
    video_url: string | null;
    tags: unknown;
    created_at: string;
    stores: { name: string; slug: string; is_example: boolean } | Array<{ name: string; slug: string; is_example: boolean }>;
  };
  const rows = (data ?? []) as unknown as Row[];

  // Units sold per listing. The view only counts paid and fulfilled orders.
  const sold = new Map<string, number>();
  if (rows.length) {
    const { data: trend } = await sb
      .from('trending_products')
      .select('id, order_count')
      .in('id', rows.map((r) => r.id));
    for (const t of (trend ?? []) as Array<{ id: string; order_count: number | string | null }>) {
      sold.set(t.id, Number(t.order_count) || 0);
    }
  }

  const items: TaggedListing[] = rows.map((r) => {
    const store = Array.isArray(r.stores) ? r.stores[0]! : r.stores;
    const imgs = Array.isArray(r.image_urls) ? r.image_urls : [];
    return {
      id: r.id,
      title: r.title,
      priceKobo: Number(r.price_kobo) || 0,
      compareAtKobo: r.compare_at_kobo == null ? null : Number(r.compare_at_kobo),
      stock: r.stock,
      type: r.type,
      cover: imgs.find(https) ?? null,
      hasVideo: https(r.video_url),
      storeName: store?.name ?? '',
      storeSlug: store?.slug ?? '',
      isExample: Boolean(store?.is_example),
      sold: sold.get(r.id) ?? 0,
      tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
      createdAt: r.created_at,
    };
  });
  // Real sales first; ties keep the newest listing on top. Example stores go last.
  items.sort((a, b) => Number(a.isExample) - Number(b.isExample) || b.sold - a.sold || b.createdAt.localeCompare(a.createdAt));
  return { tag, items: items.slice(0, limit) };
}

/** The most used hashtags across listed stores, with how many listings carry each. */
export async function popularHashtags(limit = 40): Promise<Array<{ tag: string; count: number }>> {
  const sb = supabaseAnon();
  const { data, error } = await sb
    .from('listings')
    .select('tags, stores!inner(is_example)')
    .in('stores.is_example', LISTED_EXAMPLE_VALUES)
    .not('tags', 'is', null)
    .limit(2000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ tags: unknown }>) {
    if (!Array.isArray(row.tags)) continue;
    for (const t of row.tags) {
      const tag = normaliseHashtag(t);
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
