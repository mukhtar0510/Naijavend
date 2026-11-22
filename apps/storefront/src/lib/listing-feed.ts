// Listings from every store in one feed: the /products page and the Discover
// Explore grid. Public columns only (never digital_file_path), read with the
// anon key so RLS decides visibility. Sample (is_example) stores follow the
// same listing rule as the rest of the marketplace.
import { supabaseAnon } from '@/lib/supabase';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';

export type FeedSort = 'new' | 'price-asc' | 'price-desc';
export type FeedType = 'all' | 'product' | 'service';

export interface FeedItem {
  id: string;
  title: string;
  priceKobo: number;
  compareAtKobo: number | null;
  stock: number | null;
  type: string;
  cover: string | null;
  video: string | null;
  storeName: string;
  storeSlug: string;
  storeCategory: string;
  isExample: boolean;
}

const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 1000;

/** Make a buyer's words safe inside a PostgREST `or=(…ilike…)` filter. */
export function feedTerm(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(/[,()%_\\*:"'.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export async function fetchListingFeed(opts: {
  q?: string;
  category?: string;
  type?: FeedType;
  sort?: FeedSort;
  limit?: number;
  offset?: number;
}): Promise<{ items: FeedItem[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 48, 1), 96);
  const offset = Math.max(opts.offset ?? 0, 0);
  const term = feedTerm(opts.q);
  const sb = supabaseAnon();
  let query = sb
    .from('listings')
    .select(
      'id, title, price_kobo, compare_at_kobo, stock, type, image_urls, video_url, created_at, stores!inner(name, slug, category, is_example)',
      { count: 'exact' },
    )
    .in('stores.is_example', LISTED_EXAMPLE_VALUES);
  if (term) {
    // Every word must appear in the listing (title, description, category) or
    // in its store (name, trade): "phone" finds a power bank from a phone shop.
    const words = term.split(' ').slice(0, 4);
    const storeHits = await Promise.all(
      words.map((w) =>
        sb
          .from('stores')
          .select('id')
          .or(`name.ilike.%${w}%,category.ilike.%${w}%`)
          .in('is_example', LISTED_EXAMPLE_VALUES)
          .limit(200)
          .then(({ data }) => (data ?? []).map((r) => String((r as { id: string }).id)).filter((id) => /^[0-9a-f-]{36}$/.test(id))),
      ),
    );
    words.forEach((w, i) => {
      const ids = storeHits[i] ?? [];
      const inStores = ids.length ? `,store_id.in.(${ids.join(',')})` : '';
      query = query.or(`title.ilike.%${w}%,description.ilike.%${w}%,category.ilike.%${w}%${inStores}`);
    });
  }
  if (opts.category) query = query.eq('stores.category', opts.category);
  if (opts.type && opts.type !== 'all') query = query.eq('type', opts.type);
  if (opts.sort === 'price-asc') query = query.order('price_kobo', { ascending: true });
  else if (opts.sort === 'price-desc') query = query.order('price_kobo', { ascending: false });
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
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
    stores: { name: string; slug: string; category: string; is_example: boolean } | Array<{ name: string; slug: string; category: string; is_example: boolean }>;
  };
  const items = ((data ?? []) as unknown as Row[]).map((r) => {
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
      video: https(r.video_url) ? r.video_url : null,
      storeName: store?.name ?? '',
      storeSlug: store?.slug ?? '',
      storeCategory: store?.category ?? 'general',
      isExample: !!store?.is_example,
    };
  });
  return { items, total: count ?? items.length };
}
