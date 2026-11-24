import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { supabaseAnon, supabaseServiceOptional } from '@/lib/supabase';
import type { BusinessHours } from '@idevtenancy/shared';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';
import { inIlorin, nearestArea } from '@/lib/ilorin';
import { HomeBrowser } from '@/components/home/HomeBrowser';
import '../../../styles/home.css';
import type { HomeStore } from '@/components/home/types';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath
export const metadata: Metadata = {
  title: 'Home — shop Ilorin stores',
  description:
    'Kwaravend Home: see which Ilorin stores are open near you, with prices in naira, and order, book or chat on WhatsApp.',
};

// PostgREST one-to-one embeds return objects, one-to-many arrays — normalise both.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type Row = Record<string, unknown> & {
  store_rating_stats?: unknown;
  store_themes?: unknown;
};

/**
 * /home — the buyer home (REDESIGN_V2 §6). The server loads real stores and
 * trending products; everything interactive (area, chips, open-now, the
 * diorama) lives in <HomeBrowser>, which computes "open now" in the buyer's
 * browser so it uses Ilorin time.
 */
export default async function HomePage() {
  let stores: HomeStore[] = [];
  let loadError = false;

  try {
    const sb = supabaseAnon();
    const { data, error } = await sb
      .from('stores')
      .select(
        'id, slug, name, category, latitude, longitude, business_hours, verification_status, is_example, created_at, store_rating_stats(review_count, avg_stars), store_themes(logo_url, favicon_url, banner_url, subheader_url)',
      )
      .in('is_example', LISTED_EXAMPLE_VALUES)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    stores = ((data ?? []) as Row[]).map((r) => {
      const stats = one(r.store_rating_stats as { review_count?: number; avg_stars?: number } | null);
      const theme = one(
        r.store_themes as { logo_url?: string | null; favicon_url?: string | null; banner_url?: string | null; subheader_url?: string | null } | null,
      );
      const lat = r.latitude == null ? null : Number(r.latitude);
      const lng = r.longitude == null ? null : Number(r.longitude);
      const area = lat != null && lng != null && inIlorin(lat, lng) ? nearestArea(lat, lng) : null;
      return {
        id: String(r.id),
        slug: String(r.slug),
        name: String(r.name),
        category: String(r.category ?? 'other'),
        logo: theme?.logo_url ?? theme?.favicon_url ?? null,
        banner: theme?.banner_url ?? theme?.subheader_url ?? null,
        verified: r.verification_status === 'verified',
        isExample: Boolean(r.is_example),
        hours: (r.business_hours as BusinessHours | null) ?? null,
        areaId: area?.id ?? null,
        areaLabel: area?.label ?? null,
        reviewCount: Number(stats?.review_count ?? 0),
        avgStars: Number(stats?.avg_stars ?? 0),
        createdAt: String(r.created_at),
      };
    });
  } catch (err) {
    console.error('[home] failed to load stores:', err);
    loadError = true;
  }

  // Trending products via the trending_products view (aggregated paid-order counts,
  // no customer data exposed). Falls back to the newest products while orders are sparse.
  let trending: ProductCardItem[] = [];
  try {
    const sb = supabaseAnon();
    // The view reads orders, so only the server (service role) may query it.
    const { data: rows } = await (supabaseServiceOptional() ?? sb)
      .from('trending_products')
      .select('id, title, price_kobo, compare_at_kobo, type, image_urls, store_name, store_slug, order_count')
      .order('order_count', { ascending: false })
      .order('title', { ascending: true })
      .limit(4);
    const ranked = (rows ?? []) as Array<Record<string, unknown>>;
    let source = ranked;
    if (ranked.every((r) => Number(r.order_count) === 0)) {
      const { data: newest } = await sb
        .from('listings')
        .select('id, title, price_kobo, compare_at_kobo, type, image_urls, stores(name, slug)')
        .eq('type', 'product')
        .order('created_at', { ascending: false })
        .limit(4);
      source = (newest ?? []).map((l: Record<string, unknown>) => {
        const store = l.stores as Record<string, unknown> | null;
        return { ...l, store_name: store?.name, store_slug: store?.slug };
      });
    }
    trending = source.map((r) => {
      const urls = (r.image_urls as string[] | null) ?? [];
      return {
        id: String(r.id),
        title: String(r.title),
        priceKobo: Number(r.price_kobo),
        compareAtKobo: r.compare_at_kobo == null ? null : Number(r.compare_at_kobo),
        type: String(r.type),
        imageUrl: urls[0] ?? null,
        storeName: String(r.store_name ?? ''),
        storeSlug: String(r.store_slug ?? ''),
      };
    });
  } catch (err) {
    console.error('[home] failed to load trending:', err);
  }

  return (
    <main className="kvhome">
      <HomeBrowser stores={stores} loadError={loadError} />

      <div className="container kvhome-body">
        <RecentlyViewed />

        {trending.length > 0 && (
          <section className="kvhome-section" aria-labelledby="kvh-trending-title">
            <div className="kvhome-head">
              <div>
                <h2 id="kvh-trending-title">Products from Ilorin stores</h2>
                <p>Most-ordered first once orders come in, newest otherwise.</p>
              </div>
              <Link href="/search" className="kvhome-link">
                Search everything <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <div className="nv-product-row">
              {trending.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        <section className="kvhome-sell" aria-labelledby="kvh-sell-title">
          <div>
            <h2 id="kvh-sell-title">Sell in Ilorin?</h2>
            <p>Open a free store, share one link, and take orders with pickup or delivery. No commission.</p>
          </div>
          <Link href="/dashboard" className="btn btn-primary">
            Open your store, free <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </div>
    </main>
  );
}
