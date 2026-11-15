import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { categoryClass, categoryEmoji, categoryLabel } from '@idevtenancy/shared';
import { Stars } from '@/components/Stars';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { HeroSearch } from '@/components/HeroSearch';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath

// PostgREST one-to-one embeds return objects, one-to-many arrays — normalise both.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}



export default async function HomePage() {
  let featured: Array<Store & { stats: StoreRatingStats | null; theme: StoreTheme | null }> = [];
  let error: string | null = null;

  try {
    const sb = supabaseAnon();
    const { data, error: dbError } = await sb
      .from('stores')
      .select('*, store_rating_stats(review_count, avg_stars, weighted_score, overall_rank, category_rank), store_themes(*)')
      .order('created_at', { ascending: false })
      .limit(6);
    if (dbError) throw dbError;
    featured = (data ?? []).map((s: Record<string, unknown>) => {
      const { store_rating_stats, store_themes, ...store } = s as Record<string, unknown> & {
        store_rating_stats?: StoreRatingStats[] | StoreRatingStats;
        store_themes?: StoreTheme[] | StoreTheme;
      };
      return {
        ...(store as unknown as Store),
        stats: one(store_rating_stats),
        theme: one(store_themes),
      };
    });
  } catch (err) {
    console.error('[home] failed to load stores:', err);
    error = 'Could not load stores right now. If this is a fresh install, check your Supabase env vars.';
  }

  // Trending products via the trending_products view (aggregated paid-order counts,
  // no customer data exposed). Falls back to the newest products while orders are sparse.
  let trending: ProductCardItem[] = [];
  try {
    const sb = supabaseAnon();
    const { data: rows } = await sb
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
    <main>
      {/* Colourful hero */}
      <div className="market-hero">
        <div className="hero-blob b1" />
        <div className="hero-blob b2" />
        <div className="hero-blob b3" />
        <div className="container" style={{ padding: '64px 20px 56px', position: 'relative' }}>
          <section style={{ maxWidth: 720 }}>
            <span className="hero-chip">🇳🇬 Trusted by real customers across Nigeria</span>
            <h1 className="hero-title">
              Discover local stores
              <br />
              you can <span style={{ color: 'var(--blue)' }}>actually</span> trust.
            </h1>
            <p className="muted" style={{ fontSize: 18, marginBottom: 26 }}>
              Real businesses, real locations, verified reviews — order products, book services
              and chat with sellers in one place. Are you a seller?{' '}
              <Link href="/dashboard">Open your own store site</Link> in minutes.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/discover" className="btn btn-primary btn-lg">Browse stores</Link>
              <Link href="/rankings" className="btn btn-black btn-lg">Top-ranked stores</Link>
            </div>
            <HeroSearch trending={trending} />
          </section>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 20px' }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ marginBottom: 4 }}>Fresh on Naijavend</h2>
          <Link href="/discover">See all stores →</Link>
        </div>

        {featured.length === 0 && !error ? (
          <div className="empty-state">
            No stores yet — the first one could be yours.{' '}
            <Link href="/dashboard">Create a store site →</Link>
          </div>
        ) : (
          <div className="store-cards" style={{ marginTop: 20 }}>
            {featured.map((store) => {
              const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
              const banner = store.theme?.banner_url ?? store.theme?.subheader_url ?? null;
              const catClass = categoryClass(store.category);
              const catEmoji = categoryEmoji(store.category);
              return (
                <Link key={store.id} href={`/s/${store.slug}`} className="store-card">
                  <div
                    className="store-card-banner"
                    style={
                      banner
                        ? { backgroundImage: `url('${banner}')` }
                        : {
                            background:
                              'radial-gradient(320px 130px at 80% -30%, var(--blue-tint-2), transparent 70%), radial-gradient(260px 120px at 10% 130%, #fdeef4, transparent 70%), var(--elevated-2)',
                          }
                    }
                  />
                  <div className="store-card-body">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                      <img className="store-card-logo" src={logo} alt={`${store.name} logo`} />
                    ) : (
                      <div className="store-card-logo-fallback" style={{ background: 'var(--blue)' }}>
                        {store.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <h3>{store.name}</h3>
                      <span className={`badge ${catClass}`}>{catEmoji} {categoryLabel(store.category)}</span>
                      {store.is_dropshipper && <span className="badge badge-dropship" title="Ships from a supplier">🚚 Dropshipper</span>}
                    </div>
                    {store.stats && store.stats.review_count > 0 ? (
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Stars value={Number(store.stats.avg_stars)} showNumeric={false} />
                        <span className="muted" style={{ fontSize: 13.5 }}>
                          {Number(store.stats.avg_stars).toFixed(1)} · {store.stats.review_count} review{store.stats.review_count === 1 ? '' : 's'}
                        </span>
                      </span>
                    ) : (
                      <span className="badge">New — be the first to review</span>
                    )}
                    <p className="store-card-desc">
                      {store.description.slice(0, 120)}
                      {store.description.length > 120 ? '…' : ''}
                    </p>
                    {store.address && (
                      <p className="store-card-addr">📍 {store.address}</p>
                    )}
                    <span className="store-card-visit">Visit store site →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <RecentlyViewed />

        {/* Trending products across all stores */}
        {trending.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ marginBottom: 4 }}>🔥 Trending products</h2>
              <Link href="/search">Search everything →</Link>
            </div>
            <div className="product-row" style={{ marginTop: 14 }}>
              {trending.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section style={{ marginTop: 56 }}>
          <h2>How Naijavend works</h2>
          <div className="listing-grid" style={{ marginTop: 14 }}>
            <div className="card">
              <div style={{ fontSize: 30, marginBottom: 6 }}>🔎</div>
              <h3 style={{ fontSize: 17 }}>Find a real business</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                Every store has a location, real reviews from real customers, and a public ranking.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 30, marginBottom: 6 }}>🛒</div>
              <h3 style={{ fontSize: 17 }}>Order or book</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                Products get ordered and delivered; services get booked as real appointments.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 30, marginBottom: 6 }}>💬</div>
              <h3 style={{ fontSize: 17 }}>Chat before you buy</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                Message the seller in-app or jump to WhatsApp — ask anything, negotiate, confirm.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 30, marginBottom: 6 }}>⭐</div>
              <h3 style={{ fontSize: 17 }}>Rate your experience</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                Your rating feeds the rankings, so the best sellers rise to the top.
              </p>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <Link href="/about" className="btn btn-black btn-lg">What is Naijavend? Take the tour →</Link>
        </div>
      </div>
    </main>
  );
}
