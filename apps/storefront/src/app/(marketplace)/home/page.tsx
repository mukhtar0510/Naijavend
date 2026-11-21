import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Store as StoreIcon,
} from 'lucide-react';
import { BRAND } from '@idevtenancy/shared';
import { supabaseAnon } from '@/lib/supabase';
import { categoryClass, categoryLabel, isOpenNow, STORE_CATEGORIES } from '@idevtenancy/shared';
import { Stars } from '@/components/Stars';
import { VerifiedTick } from '@/components/VerifiedTick';
import { ExampleTag } from '@/components/ExampleStoreBanner';
import { SavedHeart } from '@/components/SavedHeart';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { HeroSearch } from '@/components/HeroSearch';
import { Reveal, Stagger, StaggerItem } from '@/components/brand/Motion';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';
import { CategoryIcon } from '@/lib/categories';
import { LANDMARKS } from '@/lib/landmarks';
import { Shirt as IcShirt, ShoppingBag as IcShoppingBag, Smartphone as IcSmartphone, Sparkles as IcSparkles, Store as IcStore, Truck as IcTruck, Utensils as IcUtensils } from 'lucide-react';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath
export const metadata: Metadata = {
  title: 'Home — shop Ilorin stores',
  description:
    'Kwaravend Home: browse verified Ilorin storefronts, see prices in naira, and order, book or chat on WhatsApp. Every seller is based in Kwara State.',
};

// Featured trades on the homepage rail. Deliberately short: the goal is
// orientation, not a directory — "All categories" leads to /discover.
const HOME_CATEGORIES = [
  'fashion',
  'beauty',
  'food',
  'electronics',
  'home-services',
  'groceries',
  'crafts',
  'education',
] as const;

// Real Ilorin neighbourhoods, so the map band points at places a buyer can
// actually walk to instead of cities the product does not serve yet.
// Landmark quick-jumps for the map band (real OSM points, lib/landmarks.ts).
const MAP_LANDMARKS = LANDMARKS.filter((l) => ['unilorin', 'alhikmah', 'kwasu', 'kwara-mall', 'emirate-mall', 'emirs-palace', 'offa'].includes(l.id));
const HERO_CATEGORIES = ['food', 'beauty', 'fashion', 'electronics', 'groceries', 'home-services'];

// PostgREST one-to-one embeds return objects, one-to-many arrays — normalise both.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const TRUST = [
  {
    icon: ShieldCheck,
    title: 'Ilorin businesses',
    text: 'Stores have a public site and a pinned Ilorin address. Stores marked Example show sample data.',
  },
  {
    icon: MapPin,
    title: 'Walkable locations',
    text: 'See open-now status plus walking and driving distance from where you are in Ilorin.',
  },
  {
    icon: Star,
    title: 'Honest reviews',
    text: 'Ratings come from customers who actually ordered — no paid stars.',
  },
  {
    icon: MessageCircle,
    title: 'Chat first',
    text: 'Ask questions in-app or on WhatsApp before you spend a naira.',
  },
];

const STEPS = [
  {
    icon: StoreIcon,
    title: 'Find a store you trust',
    text: 'Search by name, browse a trade or open the map to see who is closest and open right now.',
  },
  {
    icon: Sparkles,
    title: 'Order or book in seconds',
    text: 'Products ship to your door; services become real appointments you can manage from your account.',
  },
  {
    icon: BadgeCheck,
    title: 'Rate what happened',
    text: 'Your review feeds the public rankings, so reliable sellers rise and the rest have to catch up.',
  },
];

export default async function HomePage() {
  let featured: Array<Store & { stats: StoreRatingStats | null; theme: StoreTheme | null }> = [];
  let error: string | null = null;

  try {
    const sb = supabaseAnon();
    const { data, error: dbError } = await sb
      .from('stores')
      .select('*, store_rating_stats(review_count, avg_stars, weighted_score, overall_rank, category_rank), store_themes(*)')
      .in('is_example', LISTED_EXAMPLE_VALUES)
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

  // The hero preview borrows the newest real store so the page never shows
  // invented merchandising to a first-time visitor.
  const spotlight = featured[0] ?? null;
  // Honest preview: every badge on the spotlight card reflects real data.
  const spotlightVerified = spotlight?.verification_status === 'verified';
  const spotlightOpen = spotlight ? isOpenNow(spotlight.business_hours) : false;
  const spotlightReviews = Number(spotlight?.stats?.review_count ?? 0);
  const spotlightBanner = spotlight?.theme?.banner_url ?? spotlight?.theme?.subheader_url ?? null;
  const spotlightLogo = spotlight?.theme?.logo_url ?? spotlight?.theme?.favicon_url ?? null;

  return (
    <main className="nv-home">
      {/* ================================ HERO ================================ */}
      <section className="nv-hero">
        <span className="nv-hero-grain" aria-hidden />
        <div className="container nv-hero-inner">
          <div className="nv-hero-copy">
            <Reveal>
              <span className="nv-pill">
                <span className="nv-pill-dot" aria-hidden />
                Home · {BRAND.launchRegion.city}, {BRAND.launchRegion.state} State
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="nv-hero-title">
                Your home for Ilorin&apos;s
                <br />
                <span className="nv-grad">real storefronts.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="nv-hero-sub">
                Compare Ilorin stores, see exactly where they are and what they sell in naira, then
                order, book or chat on WhatsApp without leaving the page.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="nv-hero-search">
                <HeroSearch trending={trending} />
              </div>
              <div className="nv-hero-cats" role="list" aria-label="Popular categories">
                {HERO_CATEGORIES.map((c) => (
                  <Link key={c} role="listitem" href={`/discover?category=${c}`} className="chip">
                    <CategoryIcon category={c} size={15} /> {categoryLabel(c)}
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="nv-hero-ctas">
                <Link href="/discover" className="btn btn-primary btn-lg">
                  Browse stores <ArrowRight size={17} />
                </Link>
                <Link href="/map" className="btn btn-outline btn-lg">
                  <MapPin size={17} aria-hidden /> Open the map
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="nv-hero-proof">
                <span className="nv-avatars" aria-hidden>
                  <span><IcShoppingBag className="ico-inline" aria-hidden /></span>
                  <span><IcSparkles className="ico-inline" aria-hidden /></span>
                  <span><IcUtensils className="ico-inline" aria-hidden /></span>
                  <span><IcShirt className="ico-inline" aria-hidden /></span>
                </span>
                <p>
                  <strong>Reviews only from real orders</strong>
                  <span>Naira prices · street-level map · no fake stars</span>
                </p>
              </div>
            </Reveal>
          </div>

          {/* Live store preview — built from the newest real store. */}
          <Reveal delay={0.16} className="nv-hero-preview-wrap">
            <div className="nv-hero-preview" aria-hidden>
              <div className="nv-hp-chrome">
                <span className="nv-hp-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="nv-hp-url">kwaravend.com/s/{spotlight?.slug ?? 'your-store'}</span>
              </div>

              <div
                className="nv-hp-banner"
                style={spotlightBanner ? { backgroundImage: `url('${spotlightBanner}')` } : undefined}
              >
                {!spotlightBanner && <span className="nv-hp-banner-mark">Kwaravend</span>}
              </div>

              <div className="nv-hp-body">
                <div className="nv-hp-store">
                  {spotlightLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                    <img src={spotlightLogo} alt="" className="nv-hp-logo" />
                  ) : (
                    <span className="nv-hp-logo nv-hp-logo-fallback">
                      {(spotlight?.name ?? 'K').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>
                      {spotlight?.name ?? 'Your store, live'}
                      {spotlightVerified && <VerifiedTick size={13} />}
                      {spotlight?.is_example && <ExampleTag />}
                    </strong>
                    <span>
                      {spotlight ? categoryLabel(spotlight.category) : 'Beauty & lifestyle'} · Ilorin
                    </span>
                  </div>
                </div>

                <div className="nv-hp-grid">
                  <span className="nv-hp-tile t1" />
                  <span className="nv-hp-tile t2" />
                  <span className="nv-hp-tile t3" />
                </div>

                <div className="nv-hp-foot">
                  <span>
                    {spotlightReviews > 0 ? (
                      <>
                        <Star size={12} /> {Number(spotlight?.stats?.avg_stars ?? 0).toFixed(1)}
                        <em>
                          {spotlightReviews} review{spotlightReviews === 1 ? '' : 's'}
                        </em>
                      </>
                    ) : (
                      <em>No reviews yet</em>
                    )}
                  </span>
                  {spotlightOpen ? (
                    <span className="nv-hp-open">
                      <i /> Open now
                    </span>
                  ) : null}
                </div>
              </div>

              {spotlightVerified && (
                <span className="nv-hp-float f1">
                  <ShieldCheck size={13} /> Verified seller
                </span>
              )}
              <span className="nv-hp-float f2">
                <MessageCircle size={13} /> Chat or order on WhatsApp
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== TRUST BAR ============================= */}
      <section className="nv-trust" aria-label="Why buy on Kwaravend">
        <div className="container nv-trust-grid">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="nv-trust-item">
              <span className="nv-trust-ico" aria-hidden>
                <Icon size={17} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="container nv-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* ============================== CATEGORIES ============================ */}
        <section className="nv-section" aria-labelledby="nv-cats-title">
          <div className="nv-section-head">
            <div>
              <h2 id="nv-cats-title">Shop by trade</h2>
              <p>Tailors in Tanke, food sellers in Fate, tech shops on Taiwo Road — pick a trade to start.</p>
            </div>
            <Link href="/discover" className="nv-section-link">
              All {STORE_CATEGORIES.length} categories <ArrowRight size={15} />
            </Link>
          </div>

          <div className="nv-cat-rail">
            {HOME_CATEGORIES.map((c) => (
              <Link key={c} href={`/discover?category=${c}`} className="nv-cat-tile">
                <span className="nv-cat-emoji" aria-hidden>
                  <CategoryIcon category={c} />
                </span>
                <span className="nv-cat-label">{categoryLabel(c)}</span>
                <ArrowRight size={14} className="nv-cat-arrow" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        {/* ============================ FEATURED STORES ======================== */}
        <section className="nv-section" aria-labelledby="nv-stores-title">
          <div className="nv-section-head">
            <div>
              <h2 id="nv-stores-title">Fresh on Kwaravend</h2>
              <p>New storefronts from Ilorin sellers who just went live.</p>
            </div>
            <Link href="/discover" className="nv-section-link">
              See all stores <ArrowRight size={15} />
            </Link>
          </div>

          {featured.length === 0 && !error ? (
            <div className="nv-empty">
              <span aria-hidden><IcStore className="ico-inline" aria-hidden /></span>
              <h3>No stores yet — the first one could be yours</h3>
              <p>Open a free storefront in minutes and appear right here.</p>
              <Link href="/dashboard" className="btn btn-primary">
                Create your store <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <Stagger className="nv-store-grid">
              {featured.map((store) => {
                const logo = store.theme?.logo_url ?? store.theme?.favicon_url ?? null;
                const banner = store.theme?.banner_url ?? store.theme?.subheader_url ?? null;
                const catClass = categoryClass(store.category);
                const verified = store.verification_status === 'verified';
                return (
                  <StaggerItem key={store.id} className="nv-store-wrap">
                    <Link href={`/s/${store.slug}`} className="nv-store-card">
                      <div
                        className="nv-store-banner"
                        style={
                          banner
                            ? { backgroundImage: `url('${banner}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            : undefined
                        }
                      >
                        <span className={`nv-store-cat ${catClass}`}>
                          <span aria-hidden><CategoryIcon category={store.category} /></span>
                          {categoryLabel(store.category)}
                        </span>
                        {store.is_dropshipper && <span className="nv-store-flag"><IcTruck className="ico-inline" aria-hidden /> Dropship</span>}
                      </div>

                      <div className="nv-store-body">
                        <div className="nv-store-head">
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                            <img className="nv-store-logo" src={logo} alt={`${store.name} logo`} loading="lazy" />
                          ) : (
                            <span className="nv-store-logo nv-store-logo-fallback" aria-hidden>
                              {store.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="nv-store-id">
                            <h3>
                              <span>{store.name}</span>
                              {verified && <VerifiedTick size={15} />}
                              {store.is_example ? <ExampleTag /> : null}
                            </h3>
                            {store.stats && store.stats.review_count > 0 ? (
                              <span className="nv-store-rating">
                                <Stars value={Number(store.stats.avg_stars)} showNumeric={false} />
                                <em>
                                  {Number(store.stats.avg_stars).toFixed(1)} · {store.stats.review_count}{' '}
                                  review{store.stats.review_count === 1 ? '' : 's'}
                                </em>
                              </span>
                            ) : (
                              <span className="nv-store-new">New — be the first to review</span>
                            )}
                          </div>
                        </div>

                        {store.description ? (
                          <p className="nv-store-desc">
                            {store.description.slice(0, 130)}
                            {store.description.length > 130 ? '…' : ''}
                          </p>
                        ) : null}

                        <div className="nv-store-foot">
                          <span className="nv-store-addr">
                            <MapPin size={13} aria-hidden />
                            {store.address?.trim() || 'Online store'}
                          </span>
                          <span className="nv-store-visit">
                            Visit <ArrowRight size={14} aria-hidden />
                          </span>
                        </div>
                      </div>
                    </Link>
                    <SavedHeart slug={store.slug} name={store.name} />
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </section>

        <RecentlyViewed />

        {/* ============================ TRENDING PRODUCTS ====================== */}
        {trending.length > 0 && (
          <section className="nv-section" aria-labelledby="nv-trending-title">
            <div className="nv-section-head">
              <div>
                <h2 id="nv-trending-title">Trending right now</h2>
                <p>The products buyers are ordering most across every Ilorin store.</p>
              </div>
              <Link href="/search" className="nv-section-link">
                Search everything <ArrowRight size={15} />
              </Link>
            </div>
            <div className="nv-product-row">
              {trending.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ================================ MAP BAND ============================ */}
      <section className="nv-mapband-wrap" aria-labelledby="nv-map-title">
        <div className="container">
          <div className="nv-mapband">
            <div className="nv-mapband-copy">
              <span className="nv-pill nv-pill-invert">
                <MapPin size={13} aria-hidden /> Ilorin street map
              </span>
              <h2 id="nv-map-title">Find out who&apos;s open near you</h2>
              <p>
                Real addresses, live open-now status and directions from your exact spot, with
                landmarks across Kwara. Your location stays in your browser.
              </p>
              <div className="nv-mapband-chips">
                {MAP_LANDMARKS.map((l) => (
                  <Link key={l.id} href="/map" className="nv-mapband-chip">
                    <MapPin size={12} aria-hidden /> {l.short ?? l.name}
                  </Link>
                ))}
              </div>
              <div className="nv-mapband-actions">
                <Link href="/map" className="btn btn-white btn-lg">
                  Open the map <ArrowRight size={16} />
                </Link>
                <Link href="/discover" className="btn btn-ghost-light btn-lg">
                  Browse the list
                </Link>
              </div>
            </div>

            <div className="nv-mapband-visual" aria-hidden>
              <span className="nv-mb-road r1" />
              <span className="nv-mb-road r2" />
              <span className="nv-mb-road r3" />
              <span className="nv-mb-me" />
              <span className="nv-mb-pin p1"><IcSparkles className="ico-inline" aria-hidden /></span>
              <span className="nv-mb-pin p2"><IcUtensils className="ico-inline" aria-hidden /></span>
              <span className="nv-mb-pin p3"><IcShirt className="ico-inline" aria-hidden /></span>
              <span className="nv-mb-pin p4"><IcSmartphone className="ico-inline" aria-hidden /></span>
              <span className="nv-mb-tag t1">Open now</span>
              <span className="nv-mb-tag t2">Directions in one tap</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================ HOW IT WORKS ======================== */}
      <section className="nv-section container" aria-labelledby="nv-steps-title">
        <div className="nv-section-head">
          <div>
            <h2 id="nv-steps-title">How Kwaravend works</h2>
            <p>Built for how shopping actually happens in Ilorin.</p>
          </div>
        </div>
        <div className="nv-steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="nv-step">
              <span className="nv-step-num" aria-hidden>
                0{i + 1}
              </span>
              <span className="nv-step-ico" aria-hidden>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================ SELLER CTA ========================== */}
      <section className="container nv-cta-wrap" aria-labelledby="nv-cta-title">
        <div className="nv-cta">
          <div>
            <span className="nv-pill nv-pill-invert">Free, forever</span>
            <h2 id="nv-cta-title">Your Ilorin store deserves its own website.</h2>
            <p>
              Catalogue, bookings, chat, POS, staff accounts and a blue tick — all included. Our AI
              can design the whole storefront for you in minutes.
            </p>
          </div>
          <div className="nv-cta-actions">
            <Link href="/dashboard" className="btn btn-white btn-lg">
              Open your store <ArrowRight size={16} />
            </Link>
            <Link href="/about" className="btn btn-ghost-light btn-lg">
              Take the tour
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
