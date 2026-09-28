import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { Stars } from '@/components/Stars';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

const KINDS = new Set(['all', 'product', 'service', 'store']);

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; kind?: string };
}) {
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  // Escape PostgREST ilike wildcards so % and _ from user input can't scan the table.
  const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const kind = KINDS.has(searchParams.kind ?? '') ? (searchParams.kind as string) : 'all';

  let products: ProductCardItem[] = [];
  let stores: Array<Store & { stats: StoreRatingStats | null; theme: StoreTheme | null }> = [];
  let error: string | null = null;

  if (q) {
    try {
      const sb = supabaseAnon();

      if (kind === 'all' || kind === 'product' || kind === 'service') {
        let query = sb
          .from('listings')
          .select('id, title, price_kobo, compare_at_kobo, type, image_urls, stores(name, slug)')
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(24);
        if (kind === 'product' || kind === 'service') query = query.eq('type', kind);
        const { data, error: dbError } = await query;
        if (dbError) throw dbError;
        products = (data ?? []).map((l: Record<string, unknown>) => {
          const store = l.stores as Record<string, unknown> | null;
          const urls = (l.image_urls as string[] | null) ?? [];
          return {
            id: String(l.id),
            title: String(l.title),
            priceKobo: Number(l.price_kobo),
            compareAtKobo: l.compare_at_kobo == null ? null : Number(l.compare_at_kobo),
            type: String(l.type),
            imageUrl: urls[0] ?? null,
            storeName: String(store?.name ?? ''),
            storeSlug: String(store?.slug ?? ''),
          };
        });
      }

      if (kind === 'all' || kind === 'store') {
        const { data, error: dbError } = await sb
          .from('stores')
          .select('*, store_rating_stats(review_count, avg_stars), store_themes(*)')
          .ilike('name', like)
          .limit(12);
        if (dbError) throw dbError;
        stores = (data ?? []).map((s: Record<string, unknown>) => {
          const { store_rating_stats, store_themes, ...store } = s as Record<string, unknown> & {
            store_rating_stats?: StoreRatingStats[] | StoreRatingStats;
            store_themes?: StoreTheme[] | StoreTheme;
          };
          return { ...(store as unknown as Store), stats: one(store_rating_stats), theme: one(store_themes) };
        });
      }
    } catch (err) {
      console.error('[search] failed:', err);
      error = 'Search hit a snag — try again in a moment.';
    }
  }

  const nothing = q && products.length === 0 && stores.length === 0 && !error;

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>{q ? `Results for “${q}”` : 'Search Naijavend'}</h1>
          <p>Products, services and stores — one search box.</p>
        </div>
      </div>      <div className="container" style={{ padding: '28px 20px' }}>
      {/* The search box itself — GET form, works without client JS. */}
      <form action="/search" method="get" className="searchbar" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search products, services or stores…"
          aria-label="Search Naijavend"
          maxLength={80}
        />
        <select name="kind" defaultValue={kind} aria-label="Search category">
          <option value="all">Everything</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
          <option value="store">Stores</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {!q && (
        <div className="card" style={{ marginTop: 18, maxWidth: 560 }}>
          <p style={{ margin: 0 }}>
            Try “cakes”, “braids”, “repair” — or browse{' '}
            <Link href="/discover">all stores</Link>,{' '}
            <Link href="/rankings">top-ranked stores</Link>.
          </p>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginTop: 18 }}>{error}</div>}

      {nothing && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          Nothing matched “{q}”. Try a shorter word, or{' '}
          <Link href="/discover">browse all stores</Link>.
        </div>
      )}

      {stores.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2>Stores</h2>
          <div className="store-cards" style={{ marginTop: 14 }}>
            {stores.map((store) => {
              const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
              return (
                <Link key={store.id} href={`/s/${store.slug}`} className="store-card">
                  <div
                    className="store-card-banner"
                    style={
                      (store.theme?.banner_url ?? store.theme?.subheader_url)
                        ? { backgroundImage: `url('${store.theme?.banner_url ?? store.theme?.subheader_url}')` }
                        : undefined
                    }
                  />
                  <div className="store-card-body">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                      <img className="store-card-logo" src={logo} alt="" />
                    ) : (
                      <div className="store-card-logo-fallback" style={{ background: 'var(--blue)' }}>
                        {store.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <h3>{store.name}</h3>
                      {store.is_dropshipper && <span className="badge badge-dropship" title="Ships from a supplier">🚚 Dropshipper</span>}
                    </div>
                    {store.stats && store.stats.review_count > 0 && (
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Stars value={Number(store.stats.avg_stars)} showNumeric={false} />
                        <span className="muted" style={{ fontSize: 13.5 }}>
                          {Number(store.stats.avg_stars).toFixed(1)} · {store.stats.review_count} reviews
                        </span>
                      </span>
                    )}
                    {store.address && <p className="store-card-addr">📍 {store.address}</p>}
                    <span className="store-card-visit">Visit store site →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2>{kind === 'service' ? 'Services' : kind === 'product' ? 'Products' : 'Products & services'}</h2>
          <div className="product-row" style={{ marginTop: 14 }}>
            {products.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  );
}
