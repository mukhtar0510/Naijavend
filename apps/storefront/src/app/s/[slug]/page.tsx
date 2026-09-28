import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase';
import { formatNaira, buildWhatsAppLink } from '@idevtenancy/shared';
import { Stars } from '@/components/Stars';
import { MapEmbed } from '@/components/MapEmbed';
import { DistanceCard } from '@/components/DistanceCard';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { TrackStoreView } from '@/components/TrackStoreView';
import { ShareBar } from '@/components/ShareBar';
import { SavedHeart } from '@/components/SavedHeart';
import { VerifiedTick } from '@/components/VerifiedTick';
import { RecordRecentView } from '@/components/RecordRecentView';
import { OpenBadge } from '@/components/OpenBadge';
import { LocationsGallery } from '@/components/LocationsGallery';
import { formatHours } from '@/lib/hours';
import { siteUrl, schemaTypeForCategory } from '@/lib/site';
import type { Listing, Store, StoreRating, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath

// PostgREST returns objects for one-to-one embeds and arrays for one-to-many;
// this normalises both so theme/settings/stats never silently fall back.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function getStore(slug: string) {
  const sb = supabaseAnon();
  const { data: store, error } = await sb
    .from('stores')
    .select('*, store_rating_stats(review_count, avg_stars, weighted_score, overall_rank, category_rank), whatsapp_settings(business_number, greeting_message, catalog_enabled), store_themes(*), store_locations(id, label, position, address, latitude, longitude, phone, note, image_url, business_hours)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return store as
    | (Store & {
        store_rating_stats: StoreRatingStats[] | StoreRatingStats | null;
        whatsapp_settings:
          | Array<{ business_number: string; greeting_message: string; catalog_enabled: boolean }>
          | { business_number: string; greeting_message: string; catalog_enabled: boolean }
          | null;
        store_themes: StoreTheme[] | StoreTheme | null;
        store_locations:
          | Array<{ id: string; label: string; position: number; address: string; latitude: number | null; longitude: number | null; phone: string; note: string; image_url: string | null; business_hours: Store['business_hours'] }>
          | null;
      })
    | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const store = await getStore(params.slug);
    if (!store) return { title: 'Store not found' };
    return {
      description: store.description || `${store.name} — a local business on Naijavend.`,
      alternates: { canonical: `${siteUrl()}/s/${store.slug}` },
      openGraph: {
        title: store.name,
        description: store.description,
        url: `${siteUrl()}/s/${store.slug}`,
        type: 'website',
      },
    };
  } catch {
    return {};
  }
}

// JSON-LD LocalBusiness so search engines see this store site as a real business
// with location, contact and (once reviewed) aggregate rating.
function LocalBusinessJsonLd({
  store,
  waNumber,
  stats,
}: {
  store: Store;
  waNumber: string;
  stats: StoreRatingStats | null;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaTypeForCategory(store.category),
    name: store.name,
    description: store.description,
    url: `${siteUrl()}/s/${store.slug}`,
  };
  if (store.address) {
    schema.address = { '@type': 'PostalAddress', streetAddress: store.address, addressCountry: 'NG' };
  }
  if (store.latitude != null && store.longitude != null) {
    schema.geo = { '@type': 'GeoCoordinates', latitude: Number(store.latitude), longitude: Number(store.longitude) };
  }
  if (waNumber) schema.telephone = waNumber;
  if (store.business_hours) {
    const dayNames: Record<string, string> = {
      mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
    };
    const specs = Object.entries(store.business_hours)
      .filter(([, range]) => Array.isArray(range))
      .map(([day, range]) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dayNames[day],
        opens: (range as [string, string])[0],
        closes: (range as [string, string])[1],
      }));
    if (specs.length) schema.openingHoursSpecification = specs;
  }
  if (stats && stats.review_count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(stats.avg_stars),
      reviewCount: stats.review_count,
    };
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const store = await getStore(params.slug);
  if (!store) notFound();

  const sb = supabaseAnon();
  const [{ data: listings }, { data: ratings }] = await Promise.all([
    sb.from('listings').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(100),
    sb.from('store_ratings').select('stars, comment, created_at').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const stats = one(store.store_rating_stats);
  const wa = one(store.whatsapp_settings);
  const waNumber = wa?.business_number || store.whatsapp_number;
  const theme = one(store.store_themes);
  const gallery = (Array.isArray(theme?.gallery_urls) ? (theme!.gallery_urls as string[]) : [])
    .filter((u) => typeof u === 'string' && /^https:\/\//.test(u))
    .slice(0, 5);
  const branches = (store.store_locations ?? []).slice().sort((a, b) => a.position - b.position);
  const brandLogo = theme?.logo_url ?? theme?.favicon_url ?? null;
  const banner = theme?.banner_url ?? null;
  const heroImage = theme?.hero_style === 'image' && banner;
  const subHeader = theme?.subheader_url ?? null;
  const hoursList = formatHours(store.business_hours);

  return (
    <main>
      <TrackStoreView storeId={store.id} />
      <RecordRecentView slug={store.slug} name={store.name} logo={brandLogo ?? null} />
      <LocalBusinessJsonLd store={store} waNumber={waNumber} stats={stats} />
      {/* Hero band — optionally skinned with the seller's banner image */}
      <div
        className={`page-hero${heroImage ? ' hero-image' : ''}`}
        style={heroImage && banner ? { backgroundImage: `url('${banner}')` } : undefined}
      >
        <div className="container store-hero">
          <header>
            {brandLogo && (
              <div className="ring-3d" style={{ display: 'inline-block', marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL */}
                <img className="store-hero-logo float-slow" src={brandLogo} alt={`${store.name} logo`} />
              </div>
            )}
            <div className="store-hero-meta">
              <span className="badge badge-blue">{store.category}</span>
              <span className="badge">{store.business_type}</span>
              {store.is_dropshipper && <span className="badge badge-dropship" title="Ships from a supplier">🚚 Dropshipper</span>}
              <OpenBadge hours={store.business_hours} />
              {stats && stats.overall_rank && stats.review_count >= 3 && (
                <span className="rank-chip">
                  #{stats.overall_rank} overall · #{stats.category_rank} in {store.category}
                </span>
              )}
            </div>
            <div className="store-hero-title">
              <h1 style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {store.name}
                {store.verification_status === 'verified' && <VerifiedTick size={22} />}
              </h1>
              <SavedHeart slug={store.slug} name={store.name} />
            </div>
        {stats && stats.review_count > 0 && (
          <p style={{ marginBottom: 12 }}>
            <Stars value={Number(stats.avg_stars)} />{' '}
            <span className="muted">{stats.review_count} review{stats.review_count === 1 ? '' : 's'}</span>
          </p>
        )}
            <p style={{ fontSize: 17, marginBottom: 8 }}>{store.description}</p>
            {store.address && (
              <p className="muted" style={{ fontSize: 14.5, marginBottom: 16 }}>
                📍 {store.address}
              </p>
            )}
            <div className="store-hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {waNumber && (
                <WhatsAppButton
                  businessNumber={waNumber}
                  storeName={store.name}
                  label="Chat on WhatsApp"
                  className="btn btn-whatsapp btn-lg"
                />
              )}
              <Link className="btn btn-primary btn-lg" href={`/s/${store.slug}/catalogue`}>
                Browse catalogue
              </Link>
              {store.address && (
                <a className="btn btn-outline btn-lg" href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              )}
            </div>
            <ShareBar
              storeId={store.id}
              storeName={store.name}
              url={`${siteUrl()}/s/${store.slug}`}
              accent={theme?.accent_color ?? null}
              logoUrl={brandLogo}
            />
          </header>
        </div>
      </div>

      {/* Announcement renders once, in the layout's top bar (store-announcement). */}

      {/* Sub-header strip — the seller's secondary picture band */}
      {subHeader && (
        <div
          className="subheader-strip"
          role="img"
          aria-label={`${store.name} banner`}
          style={{ backgroundImage: `url('${subHeader}')` }}
        />
      )}

      <div className="container store-body" style={{ padding: '28px 20px' }}>
      {/* Reach section: map, delivery/pickup info and business hours */}
      {(store.latitude != null && store.longitude != null) || store.delivery_info || hoursList ? (
        <section id="reach" className="store-section" style={{ marginBottom: 40 }}>
          <h2>Reach & visit</h2>
          <div className="reach-grid">
            {store.latitude != null && store.longitude != null && (
              <div>
                <MapEmbed
                  latitude={Number(store.latitude)}
                  longitude={Number(store.longitude)}
                  name={store.name}
                  extraPins={branches
                    .filter((b) => b.latitude != null && b.longitude != null)
                    .map((b) => ({
                      lat: Number(b.latitude),
                      lng: Number(b.longitude),
                      label: b.label || 'Branch',
                      address: b.address || null,
                      directionsUrl: `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`,
                    }))}
                />
                {store.address && <p className="muted" style={{ marginTop: 8 }}>{store.address}</p>}
              </div>
            )}
            {store.latitude != null && store.longitude != null && (
              <DistanceCard lat={Number(store.latitude)} lng={Number(store.longitude)} name={store.name} />
            )}
            {hoursList && (
              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Opening hours</h3>
                <table className="hours-table">
                  <tbody>
                    {hoursList.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td style={{ textAlign: 'right' }}>{row.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {store.delivery_info && (
              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: 16 }}>🚚 Delivery & pickup</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{store.delivery_info}</p>
              </div>
            )}
            {store.is_dropshipper && (
              <div className="card dropship-card">
                <h3 style={{ marginTop: 0, fontSize: 16 }}>
                  🌍 Shipping &amp; suppliers{' '}
                  <span className="badge badge-dropship" style={{ verticalAlign: 'middle' }}>Dropshipper</span>
                </h3>
                <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  {store.dropship_info ||
                    'Some items in this store ship directly from our supplier when you order — delivery windows vary by item, and tracking is shared on WhatsApp.'}
                </p>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                  Dropshipped items are clearly marked — message the store anytime for the current timeline.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Store gallery — 1–5 real photos of the shop, uploaded by the seller */}
      {gallery.length > 0 && (
        <section className="store-section" style={{ marginBottom: 40 }}>
          <h2>Inside the store</h2>
          <div className="store-gallery" style={{ ['--gallery-count' as string]: gallery.length }}>
            {gallery.map((url, i) => (
              <figure key={url} className="store-gallery-item">
                {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
                <img src={url} alt={`${store.name} — photo ${i + 1}`} loading="lazy" />
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Branches — every registered location with address, phone and hours */}
      {branches.length > 0 && (
        <section className="store-section" style={{ marginBottom: 40 }}>
          <h2>Our locations</h2>
          <LocationsGallery branches={branches} />
        </section>
      )}

      {/* Listings — homepage shows a highlight reel; the full catalogue lives on its own page */}
      <section className="store-section" style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ marginBottom: 4 }}>{store.business_type === 'service' ? 'Featured services' : 'Featured items'}</h2>
          <Link href={`/s/${store.slug}/catalogue`}>Full catalogue →</Link>
        </div>
        {(listings as Listing[] | null)?.length ? (
          <div className="listing-grid">
            {(listings as Listing[]).slice(0, 6).map((listing) => {
              const cover = (listing.image_urls ?? []).find((u) => typeof u === 'string' && /^https?:\/\//.test(u)) ?? null;
              return (
              <div key={listing.id} className="card listing-card tilt-card">
                {cover ? (
                  <Link href={`/s/${store.slug}/listing/${listing.id}`} aria-label={listing.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL */}
                    <img
                      src={cover}
                      alt=""
                      className="catalogue-cover"
                    />
                  </Link>
                ) : (
                  <Link href={`/s/${store.slug}/listing/${listing.id}`} aria-label={listing.title}>
                    <div className="catalogue-cover-fallback" aria-hidden>
                      {listing.type === 'service' ? '📅' : '🛍️'}
                    </div>
                  </Link>
                )}
                <Link href={`/s/${store.slug}/listing/${listing.id}`} style={{ color: 'inherit' }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{listing.title}</h3>
                </Link>
                <span className="price">{formatNaira(listing.price_kobo)}</span>
                {listing.description && (
                  <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                    {listing.description.slice(0, 130)}
                    {listing.description.length > 130 ? '…' : ''}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  {listing.type === 'product' ? (
                    <Link className="btn btn-primary btn-sm" href={`/s/${store.slug}/order/${listing.id}`}>
                      Order
                    </Link>
                  ) : (
                    <Link className="btn btn-primary btn-sm" href={`/s/${store.slug}/book/${listing.id}`}>
                      Book appointment
                    </Link>
                  )}
                  {waNumber && (
                    <WhatsAppButton
                      businessNumber={waNumber}
                      storeName={store.name}
                      listingTitle={listing.title}
                      priceNaira={listing.price_kobo / 100}
                      label="Ask"
                      className="btn btn-outline btn-sm"
                    />
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">This store hasn&apos;t added anything yet — check back soon, or chat on WhatsApp.</div>
        )}
      </section>

      {/* Ratings */}
      <section className="store-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h2>Customer reviews</h2>
          {(ratings as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[] | null)?.length ? (
            <Link href={`/s/${store.slug}/rate`}>Leave a review</Link>
          ) : null}
        </div>
        {(ratings as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[] | null)?.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {(ratings as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[]).map((r, i) => (
              <div key={i} className="card">
                <Stars value={r.stars} showNumeric={false} />
                {r.comment && <p style={{ margin: '8px 0 0' }}>{r.comment}</p>}
                <p className="muted mono" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                  {new Date(r.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            No reviews yet. Bought something or booked here?{' '}
            <Link href={`/s/${store.slug}/rate`}>Rate this store</Link> — it helps other customers.
          </div>
        )}
      </section>
      </div>
    </main>
  );
}
