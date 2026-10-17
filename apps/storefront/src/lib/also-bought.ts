// "People who bought this also bought" — pure order-history co-occurrence.
//
// Reads order_items twice (orders containing this listing → other items in
// those orders) through the service-role client, because order rows are private
// by design. Only already-public catalogue fields come back, plus an aggregate
// count, so a buyer learns nothing about who bought what or their phone number.
import { supabaseServiceOptional } from '@/lib/supabase';

export interface AlsoBoughtItem {
  id: string;
  title: string;
  priceKobo: number;
  compareAtKobo: number | null;
  imageUrl: string | null;
  type: 'product' | 'service' | 'digital';
  storeName: string;
  storeSlug: string;
  boughtTogether: number;
}

/** Same-store neighbours used when there is not yet a co-purchase signal —
 * still a useful answer, and never an empty section on a fresh marketplace. */
async function catalogueFallback(
  sb: NonNullable<Awaited<ReturnType<typeof supabaseServiceOptional>>>,
  storeId: string,
  listingId: string,
  limit: number,
): Promise<AlsoBoughtItem[]> {
  const { data } = await sb
    .from('listings')
    .select('id, title, price_kobo, compare_at_kobo, image_urls, type, stores(name, slug)')
    .eq('store_id', storeId)
    .neq('id', listingId)
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  return (data ?? [])
    .slice(0, limit)
    .map((row: Record<string, unknown>) => {
      const store = row.stores as { name?: string; slug?: string } | null;
      const urls = (row.image_urls as string[] | null) ?? [];
      return {
        id: String(row.id),
        title: String(row.title),
        priceKobo: Number(row.price_kobo) || 0,
        compareAtKobo: row.compare_at_kobo == null ? null : Number(row.compare_at_kobo),
        imageUrl: urls[0] ?? null,
        type: String(row.type) === 'service' ? 'service' : String(row.type) === 'digital' ? 'digital' : 'product',
        storeName: String(store?.name ?? ''),
        storeSlug: String(store?.slug ?? ''),
        boughtTogether: 0,
      } satisfies AlsoBoughtItem;
    });
}

export async function alsoBought(
  storeId: string,
  listingId: string,
  limit = 6,
): Promise<{ items: AlsoBoughtItem[]; source: 'orders' | 'catalogue' }> {
  const sb = supabaseServiceOptional();
  if (!sb || !storeId || !listingId) return { items: [], source: 'catalogue' };

  try {
    // 1. Recent orders that contain this listing (the cap keeps step 2 O(1)).
    const { data: seeded } = await sb
      .from('order_items')
      .select('order_id')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(150);
    const orderIds = [...new Set((seeded ?? []).map((r) => String(r.order_id)))];
    if (orderIds.length === 0) {
      return { items: await catalogueFallback(sb, storeId, listingId, limit), source: 'catalogue' };
    }

    // 2. Everything else bought inside those orders.
    const { data: rows } = await sb
      .from('order_items')
      .select('quantity, listing_id, listings!inner(id, title, price_kobo, compare_at_kobo, image_urls, type, store_id, stores(name, slug))')
      .in('order_id', orderIds)
      .neq('listing_id', listingId)
      .limit(2000);

    const tally = new Map<string, { units: number; row: Record<string, unknown> }>();
    for (const raw of (rows ?? []) as Array<{ quantity: number; listing_id: string; listings: unknown }>) {
      const listing = Array.isArray(raw.listings) ? (raw.listings[0] as Record<string, unknown> | undefined) : (raw.listings as Record<string, unknown> | undefined);
      if (!listing) continue;
      // Co-purchases across OTHER stores are not useful on a single store page,
      // and cross-store exposure would reveal another seller's volume.
      if (String(listing.store_id) !== storeId) continue;
      const key = String(raw.listing_id);
      const prev = tally.get(key);
      tally.set(key, { units: (prev?.units ?? 0) + (Number(raw.quantity) || 1), row: listing });
    }

    const items: AlsoBoughtItem[] = [...tally.entries()]
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, limit)
      .map(([id, { units, row }]) => {
        const store = row.stores as { name?: string; slug?: string } | null;
        const urls = (row.image_urls as string[] | null) ?? [];
        return {
          id,
          title: String(row.title),
          priceKobo: Number(row.price_kobo) || 0,
          compareAtKobo: row.compare_at_kobo == null ? null : Number(row.compare_at_kobo),
          imageUrl: urls[0] ?? null,
          type: String(row.type) === 'service' ? 'service' : String(row.type) === 'digital' ? 'digital' : 'product',
          storeName: String(store?.name ?? ''),
          storeSlug: String(store?.slug ?? ''),
          boughtTogether: units,
        };
      });

    if (items.length > 0) return { items, source: 'orders' };
    return { items: await catalogueFallback(sb, storeId, listingId, limit), source: 'catalogue' };
  } catch (err) {
    console.warn('[alsoBought] falling back to catalogue:', err);
    return { items: await catalogueFallback(sb, storeId, listingId, limit), source: 'catalogue' };
  }
}