import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { Stars } from '@/components/Stars';
import { NearbyStores } from '@/components/NearbyStores';
import { StoreMap, type MapStore } from '@/components/StoreMap';
import { DiscoverTabs } from '@/components/DiscoverTabs';
import { VerifiedTick } from '@/components/VerifiedTick';
import { SavedHeart } from '@/components/SavedHeart';
import { isOpenNow, STORE_CATEGORIES, categoryLabel, categoryEmoji, categoryClass } from '@idevtenancy/shared';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath
export const metadata = { title: 'Discover stores' };

const CATEGORIES = STORE_CATEGORIES;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string; open?: string };
}) {
  const rawCat = searchParams.category ?? '';
  const category = CATEGORIES.includes(rawCat as never) ? rawCat : undefined;
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const openOnly = searchParams.open === '1';

  const sb = supabaseAnon();
  let query = sb
    .from('stores')
    .select('*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank), store_themes(logo_url, favicon_url, banner_url, subheader_url)')
    .order('created_at', { ascending: false })
    .limit(60);
  if (category) query = query.eq('category', category);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data } = await query;
  const stores = (data ?? []).map((s: Record<string, unknown>) => {
    const { store_rating_stats, store_themes, ...store } = s as Record<string, unknown> & {
      store_rating_stats?: StoreRatingStats[] | StoreRatingStats;
      store_themes?: Array<Pick<StoreTheme, 'logo_url' | 'favicon_url' | 'banner_url' | 'subheader_url'>> | Pick<StoreTheme, 'logo_url' | 'favicon_url' | 'banner_url' | 'subheader_url'>;
    };
    const theme = Array.isArray(store_themes) ? (store_themes[0] ?? null) : (store_themes ?? null);
    return { ...(store as unknown as Store), stats: Array.isArray(store_rating_stats) ? (store_rating_stats[0] ?? null) : (store_rating_stats ?? null), theme };
  });

  const finalStores = openOnly ? stores.filter((s) => isOpenNow(s.business_hours)) : stores;

  const nearbyStores = finalStores
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ slug: s.slug, name: s.name, address: s.address ?? null, category: s.category, lat: Number(s.latitude), lng: Number(s.longitude) }));

  // Richer objects for the map locator: logo, open-now hours, rating, tick, dropshipper tag.
  const mapStores: MapStore[] = finalStores
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      category: s.category,
      lat: Number(s.latitude),
      lng: Number(s.longitude),
      address: s.address ?? null,
      logo: s.theme?.logo_url ?? s.theme?.favicon_url ?? null,
      isDropshipper: !!s.is_dropshipper,
      verified: s.verification_status === 'verified',
      rating: s.stats && s.stats.avg_stars != null ? Number(s.stats.avg_stars) : null,
      reviewCount: s.stats?.review_count ?? null,
      hours: s.business_hours ?? null,
    }));

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>Discover stores</h1>
          <p>Every store is a real Nigerian business with its own website, real location and verified reviews.</p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px' }}>

      <DiscoverTabs
        list={
          <>
      <NearbyStores stores={nearbyStores} />

      <form style={{ display: 'flex', gap: 8, margin: '18px 0 14px', flexWrap: 'wrap' }} action="/discover">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search store names…"
          style={{ flex: 1, minWidth: 220 }}
          aria-label="Search store names"
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <div className="filter-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <Link
          href={`/discover?${[category ? `category=${category}` : '', q ? `q=${encodeURIComponent(q)}` : '', openOnly ? '' : 'open=1'].filter(Boolean).join('&')}`}
          className={`filter-chip ${openOnly ? 'is-on' : ''}`}
        >
          <span aria-hidden>🟢</span> Open now
        </Link>
        <Link href={`/discover${q ? `?q=${encodeURIComponent(q)}` : ''}`} className={`filter-chip ${!category ? 'is-active' : ''}`}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/discover?category=${c}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`filter-chip ${category === c ? 'is-active' : ''}`}
          >
            <span aria-hidden>{categoryEmoji(c)}</span> {categoryLabel(c)}
          </Link>
        ))}
      </div>

      {finalStores.length === 0 ? (
        <div className="empty-state">No stores match. Try a different search or category.</div>
      ) : (
        <div className="store-cards">
          {finalStores.map((store) => {
            const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
            const banner = store.theme?.banner_url ?? store.theme?.subheader_url ?? null;
            const catClass = categoryClass(store.category);
            return (
              <div key={store.id} className="store-card-wrap">
              <Link href={`/s/${store.slug}`} className="store-card">
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
                    <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {store.name}
                    {store.verification_status === 'verified' && <VerifiedTick size={15} />}
                  </h3>
                    <span className={`badge ${catClass}`}>{categoryEmoji(store.category)} {categoryLabel(store.category)}</span>
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
                    {store.description.slice(0, 110)}
                    {store.description.length > 110 ? '…' : ''}
                  </p>
                  {store.address && <p className="store-card-addr">📍 {store.address}</p>}
                  <span className="store-card-visit">Visit store site →</span>
                </div>
              </Link>
              <SavedHeart slug={store.slug} name={store.name} />
            </div>
            );
          })}
        </div>
      )}
          </>
        }
        map={<StoreMap stores={mapStores} />}
      />
      </div>
    </main>
  );
}
