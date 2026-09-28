import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase';
import { formatNaira, buildWhatsAppLink, isValidPhone } from '@idevtenancy/shared';
import { Stars } from '@/components/Stars';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { ListingGallery } from '@/components/ListingGallery';
import { TrackStoreView } from '@/components/TrackStoreView';
import { RecordProductView } from '@/components/RecordProductView';
import { siteUrl } from '@/lib/site';
import { StoreQrCode } from '@/components/StoreQrCode';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import type { Listing, Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath

// PostgREST one-to-one embeds return objects, one-to-many arrays — normalise both.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function getListing(slug: string, listingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return null;
  const sb = supabaseAnon();
  const { data: store } = await sb
    .from('stores')
    .select('*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank), store_themes(*)')
    .eq('slug', slug)
    .maybeSingle();
  if (!store) return null;
  const { data: listing } = await sb
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .eq('store_id', (store as Store).id)
    .maybeSingle();
  if (!listing) return null;
  return { store: store as Store & { store_rating_stats: StoreRatingStats[] | StoreRatingStats | null; store_themes: StoreTheme[] | StoreTheme | null }, listing: listing as Listing };
}

export async function generateMetadata({ params }: { params: { slug: string; id: string } }): Promise<Metadata> {
  try {
    const data = await getListing(params.slug, params.id);
    if (!data) return { title: 'Not found' };
    const { store, listing } = data;
    const image = listing.image_urls?.[0];
    return {
      title: listing.title,
      description: listing.description || `${listing.title} at ${store.name}.`,
      alternates: { canonical: `${siteUrl()}/s/${store.slug}/listing/${listing.id}` },
      openGraph: {
        title: `${listing.title} — ${store.name}`,
        description: listing.description || undefined,
        url: `${siteUrl()}/s/${store.slug}/listing/${listing.id}`,
        images: image ? [image] : undefined,
        type: 'website',
      },
    };
  } catch {
    return {};
  }
}

function ProductJsonLd({ listing, store }: { listing: Listing; store: Store }) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description || undefined,
    image: listing.image_urls?.length ? listing.image_urls : undefined,
    brand: { '@type': 'Brand', name: store.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NGN',
      price: (listing.price_kobo / 100).toFixed(2),
      availability: listing.type !== 'product' || listing.stock !== 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${siteUrl()}/s/${store.slug}/listing/${listing.id}`,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}

export default async function ListingDetailPage({ params }: { params: { slug: string; id: string } }) {
  const data = await getListing(params.slug, params.id);
  if (!data) notFound();
  const { store, listing } = data;

  const stats = one(store.store_rating_stats);
  const theme = one(store.store_themes);
  const brandLogo = theme?.logo_url ?? theme?.favicon_url ?? null;
  const banner = theme?.banner_url ?? null;
  const images = (listing.image_urls ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));

  const waSettingsRow = await supabaseAnon()
    .from('whatsapp_settings')
    .select('business_number')
    .eq('store_id', store.id)
    .maybeSingle();
  const waNumber = (waSettingsRow.data as { business_number: string } | null)?.business_number || store.whatsapp_number;

  const isService = listing.type === 'service';
  const orderHref = `/s/${store.slug}/${isService ? 'book' : 'order'}/${listing.id}`;
  const onSale = listing.compare_at_kobo != null && listing.compare_at_kobo > listing.price_kobo;
  const soldOut = listing.stock === 0;
  const lowStock = !soldOut && listing.stock != null && listing.stock <= 3;
  const pctOff = onSale ? Math.round((1 - listing.price_kobo / (listing.compare_at_kobo as number)) * 100) : 0;

  return (
    <main>
      <TrackStoreView storeId={store.id} listingId={listing.id} />
      <RecordProductView
        id={listing.id}
        title={listing.title}
        priceKobo={listing.price_kobo}
        type={listing.type}
        imageUrl={images[0] ?? null}
        storeName={store.name}
        storeSlug={store.slug}
        compareAtKobo={listing.compare_at_kobo ?? null}
        stock={listing.stock ?? null}
      />
      <ProductJsonLd listing={listing} store={store} />

      <div
        className={`page-hero${theme?.hero_style === 'image' && banner ? ' hero-image' : ''}`}
        style={theme?.hero_style === 'image' && banner ? { backgroundImage: `url('${banner}')` } : undefined}
      >
        <div className="container" style={{ padding: '18px 20px 26px' }}>
          <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            <Link href={`/s/${store.slug}`}>← Back to {store.name}</Link>
          </nav>
          <span className="badge badge-blue">{isService ? 'Service' : 'Product'}</span>
        </div>
      </div>

      <div className="container" style={{ padding: '30px 20px 20px' }}>
        <div className="listing-detail">
          {/* Gallery */}
          <div>
            <ListingGallery images={images} videoUrl={listing.video_url ?? null} title={listing.title} />
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 24 }}>
              <h1 style={{ fontSize: 27, marginBottom: 8 }}>{listing.title}</h1>
              <div className="price" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '0 0 6px' }}>
                <span style={{ fontSize: 24 }}>{formatNaira(listing.price_kobo)}</span>
                {onSale && <span className="listing-compare">{formatNaira(listing.compare_at_kobo as number)}</span>}
                {onSale && <span className="product-badge badge-sale">Sale · {pctOff}% off</span>}
              </div>
              {!isService && (soldOut || lowStock) && (
                <p style={{ margin: '0 0 10px' }}>
                  <span className={`product-badge ${soldOut ? 'badge-soldout' : 'badge-lowstock'}`}>
                    {soldOut ? 'Sold out' : `Only ${listing.stock} left`}
                  </span>
                </p>
              )}
              {listing.description && <p style={{ fontSize: 15.5 }}>{listing.description}</p>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                {!isService && soldOut ? (
                  <button className="btn btn-primary btn-lg" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                    Sold out
                  </button>
                ) : (
                  <Link className="btn btn-primary btn-lg" href={orderHref}>
                    {isService ? 'Book appointment' : 'Order now'}
                  </Link>
                )}
                {isValidPhone(waNumber ?? '') && (
                  <WhatsAppButton
                    businessNumber={waNumber!}
                    storeName={store.name}
                    listingTitle={listing.title}
                    priceNaira={listing.price_kobo / 100}
                    label="Ask on WhatsApp"
                    className="btn btn-whatsapp btn-lg"
                  />
                )}
                <Link className="btn btn-outline btn-lg" href={`/s/${store.slug}/chat`}>
                  💬 Chat with us
                </Link>
              </div>

              {/* Share this product — QR + social + copy, same kit as the store home */}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                <p className="hint" style={{ margin: '0 0 10px' }}>Share this product:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <StoreQrCode
                    url={`${siteUrl()}/s/${store.slug}/listing/${listing.id}`}
                    storeName={store.name}
                    productName={listing.title}
                    tagline="Scan to view product"
                    accent={theme?.accent_color ?? null}
                    logoUrl={brandLogo}
                    variant="sharebar"
                  />
                  <CopyLinkButton url={`${siteUrl()}/s/${store.slug}/listing/${listing.id}`} label="Copy product link" />
                </div>
              </div>
            </div>

            {/* About this item */}
            <div className="card">
              <h2 style={{ fontSize: 18 }}>{isService ? 'About this service' : 'About this item'}</h2>
              {listing.description ? (
                <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
                  {listing.description
                    .split(/(?<=[.!?])\s+/)
                    .filter((s) => s.trim().length > 2)
                    .slice(0, 5)
                    .map((sentence, i) => (
                      <li key={i}>{sentence.trim()}</li>
                    ))}
                </ul>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  The seller hasn&apos;t added details yet — message them and ask anything.
                </p>
              )}
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                {isService
                  ? 'How booking works: pick a time → the seller confirms → any deposit is arranged before your appointment.'
                  : 'Payments are arranged with the seller — order here, confirm on WhatsApp, pick-up or delivery.'}
              </p>
            </div>

            {/* Store card */}
            <div className="card card-elevated" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                <img
                  src={brandLogo}
                  alt={`${store.name} logo`}
                  style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--border)' }}
                />
              ) : (
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 'var(--radius-md)',
                    display: 'grid', placeItems: 'center',
                    background: 'var(--blue-tint)', color: 'var(--blue)',
                    fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800,
                  }}
                >
                  {store.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <strong style={{ fontFamily: 'var(--font-heading)' }}>{store.name}</strong>
                {stats && stats.review_count > 0 && (
                  <div style={{ marginTop: 2 }}>
                    <Stars value={Number(stats.avg_stars)} />{' '}
                    <span className="muted" style={{ fontSize: 13.5 }}>
                      {stats.review_count} review{stats.review_count === 1 ? '' : 's'}
                      {stats.overall_rank ? ` · #${stats.overall_rank} on Naijavend` : ''}
                    </span>
                  </div>
                )}
                {store.address && <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>📍 {store.address}</p>}
              </div>
              <Link className="btn btn-outline btn-sm" href={`/s/${store.slug}`}>
                Visit store
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
