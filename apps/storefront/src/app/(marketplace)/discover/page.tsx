import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { Stars } from '@/components/Stars';
import { NearbyStores } from '@/components/NearbyStores';
import { StoreMap, type MapStore } from '@/components/StoreMap';
import { inIlorin } from '@/lib/ilorin';
import { DiscoverTabs } from '@/components/DiscoverTabs';
import { ExploreGrid, type ExploreTile } from '@/components/ExploreGrid';
import { fetchListingFeed, feedTerm, type FeedItem } from '@/lib/listing-feed';
import { nearestArea } from '@/lib/ilorin';
import { DiscoverCategories } from './DiscoverCategories';
import { AiPickRow } from '@/components/AiPickRow';
import { VerifiedTick } from '@/components/VerifiedTick';
import { ExampleTag } from '@/components/ExampleStoreBanner';
import { SavedHeart } from '@/components/SavedHeart';
import { isOpenNow, STORE_CATEGORIES, categoryLabel } from '@idevtenancy/shared';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';
import { ArrowRight, MapPin, Search, Sparkles } from 'lucide-react';

import { Stagger, StaggerItem } from '@/components/brand/Motion';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';
import { CategoryIcon } from '@/lib/categories';
import { Search as IcSearch, Truck as IcTruck } from 'lucide-react';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath
export const metadata = { title: 'Discover' };

const CATEGORIES = STORE_CATEGORIES;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string; open?: string; view?: string };
}) {
  const rawCat = searchParams.category ?? '';
  const category = CATEGORIES.includes(rawCat as never) ? rawCat : undefined;
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const openOnly = searchParams.open === '1';

  const sb = supabaseAnon();
  let query = sb
    .from('stores')
    .select('*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank), store_themes(logo_url, favicon_url, banner_url, subheader_url)')
    .in('is_example', LISTED_EXAMPLE_VALUES)
    .order('created_at', { ascending: false })
    .limit(60);
  if (category) query = query.eq('category', category);
  // The search box matches store names, descriptions and addresses; the
  // Explore grid below also matches listing titles and descriptions.
  const term = feedTerm(q);
  for (const w of term ? term.split(' ').slice(0, 4) : []) {
    query = query.or(`name.ilike.%${w}%,description.ilike.%${w}%,address.ilike.%${w}%`);
  }

  const [{ data }, feed] = await Promise.all([
    query,
    fetchListingFeed({ q, category, limit: 60 }).catch((err) => {
      console.error('[discover] listing feed failed:', err);
      return { items: [] as FeedItem[], total: 0 };
    }),
  ]);
  const stores = (data ?? []).map((s: Record<string, unknown>) => {
    const { store_rating_stats, store_themes, ...store } = s as Record<string, unknown> & {
      store_rating_stats?: StoreRatingStats[] | StoreRatingStats;
      store_themes?: Array<Pick<StoreTheme, 'logo_url' | 'favicon_url' | 'banner_url' | 'subheader_url'>> | Pick<StoreTheme, 'logo_url' | 'favicon_url' | 'banner_url' | 'subheader_url'>;
    };
    const theme = Array.isArray(store_themes) ? (store_themes[0] ?? null) : (store_themes ?? null);
    return { ...(store as unknown as Store), stats: Array.isArray(store_rating_stats) ? (store_rating_stats[0] ?? null) : (store_rating_stats ?? null), theme };
  });

  const finalStores = openOnly ? stores.filter((s) => isOpenNow(s.business_hours)) : stores;

  // Explore mosaic: listings from every store, with a store tile after every
  // four items. "Open now" narrows both to stores that are open.
  const openSlugs = new Set(finalStores.map((s) => s.slug));
  const listingTiles: ExploreTile[] = feed.items
    .filter((it) => !openOnly || openSlugs.has(it.storeSlug))
    .map((it) => ({
      kind: 'listing',
      key: `l-${it.id}`,
      href: `/s/${it.storeSlug}/listing/${it.id}`,
      title: it.title,
      priceKobo: it.priceKobo,
      storeName: it.storeName,
      category: it.storeCategory,
      image: it.cover,
      video: it.video,
      isExample: it.isExample,
    }));
  const storeTiles: ExploreTile[] = finalStores.map((s) => ({
    kind: 'store',
    key: `s-${s.id}`,
    href: `/s/${s.slug}`,
    title: s.name,
    area:
      s.latitude != null && s.longitude != null && inIlorin(Number(s.latitude), Number(s.longitude))
        ? nearestArea(Number(s.latitude), Number(s.longitude)).label
        : (s.address ?? null),
    category: s.category,
    image: s.theme?.banner_url ?? s.theme?.subheader_url ?? null,
    logo: s.theme?.logo_url ?? s.theme?.favicon_url ?? null,
    isExample: !!s.is_example,
  }));
  const tiles: ExploreTile[] = [];
  {
    let si = 0;
    listingTiles.forEach((t, i) => {
      tiles.push(t);
      if (i % 4 === 3 && si < storeTiles.length) tiles.push(storeTiles[si++]!);
    });
    while (si < storeTiles.length) tiles.push(storeTiles[si++]!);
  }

  const nearbyStores = finalStores
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ slug: s.slug, name: s.name, address: s.address ?? null, category: s.category, lat: Number(s.latitude), lng: Number(s.longitude) }));

  // Richer objects for the map locator: logo, open-now hours, rating, tick, dropshipper tag.
  // The map is Ilorin-only, so only stores pinned inside the city count.
  const mapStores: MapStore[] = finalStores
    .filter((s) => s.latitude != null && s.longitude != null && inIlorin(Number(s.latitude), Number(s.longitude)))
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
      isExample: !!s.is_example,
      rating: s.stats && s.stats.avg_stars != null ? Number(s.stats.avg_stars) : null,
      reviewCount: s.stats?.review_count ?? null,
      hours: s.business_hours ?? null,
    }));

  const withCoords = (s: Store) => s.latitude != null && s.longitude != null;
  const querySuffix = [category ? `category=${category}` : '', q ? `q=${encodeURIComponent(q)}` : '', openOnly ? 'open=1' : '']
    .filter(Boolean)
    .join('&');

  return (
    <main className="brand">
      {/* ===================== TOP: search, like an explore page ===================== */}
      <section className="ex-top">
        <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-5 sm:px-7 sm:pt-7">
          <h1 className="mb-3 font-heading text-[clamp(24px,3.4vw,32px)] font-extrabold tracking-[-0.03em] text-foreground">
            Discover
          </h1>
          <form action="/discover" role="search" className="ex-search">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {openOnly ? <input type="hidden" name="open" value="1" /> : null}
            <Search size={18} aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search products, stores and areas"
              aria-label="Search products, stores and areas in Ilorin"
              maxLength={60}
              enterKeyHint="search"
            />
            <button className="btn btn-primary btn-sm" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ============================== FILTER RAIL =========================== */}
      <section className="border-b border-border bg-surface" aria-label="Filter stores">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-7 sm:py-4">
          <DiscoverCategories current={category} q={q} openOnly={openOnly} />
        </div>
      </section>

      {/* ================================ CONTENT ============================= */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 sm:py-9 lg:py-12">
        <DiscoverTabs
          initial={searchParams.view === 'map' ? 'map' : searchParams.view === 'list' ? 'list' : 'explore'}
          explore={
            tiles.length === 0 ? (
              <div className="mt-2 rounded-[22px] border border-dashed border-border px-6 py-14 text-center" style={{ background: 'var(--elevated)' }}>
                <h2 className="mb-1.5 font-heading text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
                  {q || category || openOnly ? 'Nothing matches that search' : 'Nothing to explore yet'}
                </h2>
                <p className="mx-auto mb-5 max-w-[44ch] text-[14px] leading-relaxed text-muted-foreground">
                  {q || category || openOnly ? 'Try a shorter word or clear the filters.' : 'New Ilorin stores add products every week.'}
                </p>
                <Link href="/discover" className="btn btn-outline">
                  Clear filters
                </Link>
              </div>
            ) : (
              <>
                <div className="ex-head">
                  <h2>
                    {category ? categoryLabel(category) : 'Explore Ilorin'}
                    {q ? <span className="text-muted-foreground"> · “{q}”</span> : null}
                  </h2>
                  <p>
                    {listingTiles.length} {listingTiles.length === 1 ? 'item' : 'items'} · {storeTiles.length}{' '}
                    {storeTiles.length === 1 ? 'store' : 'stores'} ·{' '}
                    <Link href={`/products${q || category ? `?${[q ? `q=${encodeURIComponent(q)}` : '', category ? `category=${category}` : ''].filter(Boolean).join('&')}` : ''}`}>
                      All products
                    </Link>
                  </p>
                </div>
                <ExploreGrid tiles={tiles} />
                {stores.some((s) => s.is_example) ? (
                  <p className="mt-3 text-[12.5px] text-muted-foreground">Tiles marked Example are sample data.</p>
                ) : null}
              </>
            )
          }
          list={
            <>
              <AiPickRow />
              <NearbyStores stores={nearbyStores} />

              {finalStores.length === 0 ? (
                <div
                  className="mt-8 rounded-[22px] border border-dashed border-border px-6 py-16 text-center"
                  style={{ background: 'var(--elevated)' }}
                >
                  <div className="mb-3 text-3xl" aria-hidden>
                    <IcSearch className="ico-inline" aria-hidden />
                  </div>
                  <h2 className="mb-1.5 font-heading text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
                    No stores match that search
                  </h2>
                  <p className="mx-auto mb-5 max-w-[44ch] text-[14px] leading-relaxed text-muted-foreground">
                    Try a different name or clear the filters — new businesses join every week.
                  </p>
                  <Link href="/discover" className="btn btn-outline">
                    Clear filters
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-4 mt-9 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="m-0 font-heading text-[clamp(20px,2.6vw,26px)] font-extrabold tracking-[-0.03em] text-foreground">
                      {category ? categoryLabel(category) : 'All stores'}
                      {q ? <span className="text-muted-foreground"> · “{q}”</span> : null}
                    </h2>
                    <span className="text-[12.5px] font-semibold text-muted-foreground">
                      {finalStores.length} found · {finalStores.filter(withCoords).length} on the map
                    </span>
                  </div>

                  <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {finalStores.map((store) => {
                      const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
                      const banner = store.theme?.banner_url ?? store.theme?.subheader_url ?? null;
                      const verified = store.verification_status === 'verified';
                      return (
                        <StaggerItem key={store.id} className="h-full">
                          <div className="store-card-wrap h-full">
                            <Link
                              href={`/s/${store.slug}`}
                              className="brand-card-lift flex h-full flex-col overflow-hidden rounded-[22px] border border-border bg-surface no-underline"
                            >
                              <div
                                className="relative h-[104px] shrink-0"
                                style={
                                  banner
                                    ? { backgroundImage: `url('${banner}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                                    : {
                                        background:
                                          'radial-gradient(320px 130px at 82% -30%, var(--blue-tint-2), transparent 70%), radial-gradient(260px 120px at 12% 130%, #fdeef4, transparent 70%), var(--elevated-2)',
                                      }
                                }
                              >
                                {/* Top-right stays clear for the SavedHeart button. */}
                                <span className="absolute bottom-2.5 left-2.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur">
                                  <span aria-hidden style={{ marginRight: 4 }}><CategoryIcon category={store.category} /></span>
                                  {categoryLabel(store.category)}
                                </span>
                                {store.is_dropshipper ? (
                                  <span className="absolute bottom-2.5 right-2.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur">
                                    <IcTruck className="ico-inline" aria-hidden /> Dropship
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex flex-1 flex-col gap-2.5 p-4">
                                <div className="flex items-center gap-2.5">
                                  {logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                                    <img
                                      src={logo}
                                      alt={`${store.name} logo`}
                                      className="h-11 w-11 shrink-0 rounded-[13px] border border-border object-cover"
                                    />
                                  ) : (
                                    <div
                                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] font-heading text-[17px] font-extrabold text-white"
                                      style={{ background: 'var(--blue)' }}
                                      aria-hidden
                                    >
                                      {store.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h3 className="m-0 flex items-center gap-1.5 text-[15.5px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
                                      <span className="truncate">{store.name}</span>
                                      {verified ? <VerifiedTick size={15} /> : null}
                                      {store.is_example ? <ExampleTag /> : null}
                                    </h3>
                                    {store.stats && store.stats.review_count > 0 ? (
                                      <span className="mt-1 flex items-center gap-1.5">
                                        <Stars value={Number(store.stats.avg_stars)} showNumeric={false} />
                                        <span className="text-[12px] font-semibold text-muted-foreground">
                                          {Number(store.stats.avg_stars).toFixed(1)} · {store.stats.review_count} review
                                          {store.stats.review_count === 1 ? '' : 's'}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="mt-1 block text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
                                        New — be the first to review
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <p
                                  className="m-0 text-[13.5px] leading-relaxed text-muted-foreground"
                                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                >
                                  {store.description}
                                </p>

                                {store.address ? (
                                  <p className="m-0 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                    <MapPin size={13} className="shrink-0" aria-hidden />
                                    <span className="truncate">{store.address}</span>
                                  </p>
                                ) : null}

                                <span
                                  className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-bold"
                                  style={{ color: 'var(--blue)' }}
                                >
                                  Visit store <ArrowRight size={14} />
                                </span>
                              </div>
                            </Link>
                            <SavedHeart slug={store.slug} name={store.name} />
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </Stagger>
                </>
              )}

              <div className="mt-12 flex flex-wrap items-center justify-center gap-3 rounded-[22px] border border-border px-6 py-7 text-center" style={{ background: 'var(--elevated)' }}>
                <div className="w-full">
                  <h2 className="mb-1.5 font-heading text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
                    Running a business of your own?
                  </h2>
                  <p className="mx-auto mb-4 max-w-[46ch] text-[14px] leading-relaxed text-muted-foreground">
                    Get a free storefront, catalogue, bookings and POS — then show up here for buyers to find.
                  </p>
                </div>
                <Link href="/dashboard" className="btn btn-primary">
                  Open your store — free <ArrowRight size={16} />
                </Link>
                <Link href="/about" className="btn btn-outline">
                  How it works
                </Link>
              </div>
            </>
          }
          map={
            <div className="mt-6">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                <Sparkles size={14} style={{ color: 'var(--blue)' }} />
                {mapStores.length > 0
                  ? `${mapStores.length} ${mapStores.length === 1 ? 'store' : 'stores'} on the Kwara map`
                  : 'No Ilorin stores have a location yet'}
                {querySuffix ? (
                  <Link href="/discover" className="brand-chip no-underline" style={{ marginLeft: 'auto' }}>
                    Clear filters
                  </Link>
                ) : null}
              </div>
              <StoreMap stores={mapStores} />
            </div>
          }
        />
      </section>
    </main>
  );
}
