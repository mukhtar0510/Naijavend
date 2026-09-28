import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { siteUrl } from '@/lib/site';
import { Stars } from '@/components/Stars';
import { VerifyCard } from './VerifyCard';
import { StoreQrCode } from '@/components/StoreQrCode';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Normalises PostgREST embeds: one-to-one comes back as an object, one-to-many as an array.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: { created?: string };
}) {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<
    Store & { store_rating_stats: StoreRatingStats[] | StoreRatingStats | null; store_themes: StoreTheme[] | StoreTheme | null }
  >(sb, '*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank), store_themes(*)');

  if (!store) {
    return (
      <main>
        {searchParams.created && (
          <div className="alert alert-success">Store created. Finish setup below.</div>
        )}
        <h1>Welcome!</h1>
        <p className="muted">You're signed in but haven't created a store yet.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">Set up my store</Link>
      </main>
    );
  }

  const s = store as unknown as Store & {
    store_rating_stats: StoreRatingStats[] | StoreRatingStats | null;
    store_themes: StoreTheme[] | StoreTheme | null;
  };
  const stats = one(s.store_rating_stats);
  const theme = one(s.store_themes);
  const logo = theme?.logo_url ?? theme?.favicon_url ?? null;
  const banner = theme?.banner_url ?? theme?.subheader_url ?? null;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: pendingOrders }, { count: pendingBookings }, { count: reviewCount }, { count: visitsAll }, { count: visits30 }] = await Promise.all([
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('status', 'pending'),
    sb.from('bookings').select('*', { count: 'exact', head: true })
      .in('listing_id', (await sb.from('listings').select('id').eq('store_id', s.id)).data?.map((l) => l.id) ?? [])
      .eq('status', 'pending'),
    sb.from('store_ratings').select('*', { count: 'exact', head: true }).eq('store_id', s.id),
    sb.from('store_events').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('event_type', 'view'),
    sb.from('store_events').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('event_type', 'view').gte('created_at', since30),
  ]);

  return (
    <main>
      <h1>{s.name}</h1>
      <p className="dash-sub">
        Your public page:{' '}
        <Link href={`/s/${s.slug}`} target="_blank">
          /s/{s.slug}
        </Link>
      </p>

      {/* ——— Section 1: Storefront preview ——— */}
      <section className="dash-section" aria-labelledby="sec-storefront" style={{ marginTop: 12 }}>
        <div className="dash-section-head">
          <h2 id="sec-storefront">Your storefront</h2>
          <Link className="muted" href="/dashboard/settings">Customise appearance →</Link>
        </div>
        {/* Showcase — a miniature of the seller's own website */}
        <div
          className="store-showcase tilt-card"
          style={{ '--showcase-tint': `${theme?.accent_color ?? '#1D4ED8'}22` } as React.CSSProperties}
        >
          <div
            className="store-showcase-banner"
            style={
              banner
                ? { backgroundImage: `url('${banner}')` }
                : {
                    background:
                      'radial-gradient(400px 140px at 80% -30%, color-mix(in srgb, var(--showcase-tint, var(--blue-tint)) 100%, transparent), transparent 70%), var(--elevated)',
                  }
            }
          />
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', marginTop: -34, flexWrap: 'wrap' }}>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                <img className="store-showcase-logo" src={logo} alt={`${s.name} logo`} />
              ) : (
                <div className="ring-3d" style={{ width: 84, height: 84 }}>
                  <div
                    style={{
                      width: '100%', height: '100%', borderRadius: 'inherit',
                      display: 'grid', placeItems: 'center',
                      background: 'var(--surface)',
                      fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 800,
                      color: theme?.accent_color ?? 'var(--blue)',
                    }}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 220, paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 24 }}>{s.name}</h3>
                  <span className="badge badge-blue">{s.category}</span>
                  <span className="badge">{s.business_type}</span>
                  {s.plan === 'growth' && <span className="badge badge-black">Growth</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  <Stars value={Number(stats?.avg_stars ?? 0)} />
                  <span className="muted" style={{ fontSize: 14 }}>
                    {stats?.review_count ?? 0} review{(stats?.review_count ?? 0) === 1 ? '' : 's'}
                    {stats?.overall_rank && (stats?.review_count ?? 0) >= 3
                      ? ` · #${stats.overall_rank} overall · #${stats.category_rank} in ${s.category}`
                      : ''}
                  </span>
                </div>
                {s.address && (
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>📍 {s.address}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingBottom: 4 }}>
                <Link className="btn btn-primary" href={`/s/${s.slug}`} target="_blank">
                  View live site ↗
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ——— Section 1b: Share kit — QR for flyers, tags, shop window ——— */}
      <section className="dash-section" aria-labelledby="sec-qr">
        <div className="dash-section-head">
          <h2 id="sec-qr">Share kit</h2>
          <span className="muted">Your store, one scan away</span>
        </div>
        <StoreQrCode
          url={`${siteUrl()}/s/${s.slug}`}
          storeName={s.name}
          accent={theme?.accent_color ?? null}
          logoUrl={logo}
          variant="card"
          title="Store QR code"
        />
      </section>

      {/* ——— Section 2: Snapshot ——— */}
      <section className="dash-section" aria-labelledby="sec-snapshot">
        <div className="dash-section-head">
          <h2 id="sec-snapshot">Snapshot</h2>
          <span className="muted">Things that need you first</span>
        </div>
        <div className="listing-grid" style={{ margin: 0 }}>
          <div className="card card-elevated">
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Pending orders</p>
            <p style={{ fontSize: 32, margin: 0, fontFamily: 'var(--font-mono)' }}>{pendingOrders ?? 0}</p>
            <Link href="/dashboard/orders">Manage orders →</Link>
          </div>
          <div className="card card-elevated">
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Booking requests</p>
            <p style={{ fontSize: 32, margin: 0, fontFamily: 'var(--font-mono)' }}>{pendingBookings ?? 0}</p>
            <Link href="/dashboard/bookings">Review bookings →</Link>
          </div>
          <div className="card card-elevated">
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Your rank</p>
            {stats && stats.overall_rank ? (
              <>
                <p className="mono" style={{ fontSize: 32, margin: 0, color: 'var(--amber)' }}>#{stats.overall_rank}</p>
                <span className="muted" style={{ fontSize: 14, display: 'block', margin: '2px 0 6px' }}>
                  #{stats.category_rank} in {s.category}
                </span>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>Get your first review to enter the rankings.</p>
            )}
            <Link href="/dashboard/ratings">See reviews →</Link>
          </div>
          <div className="card card-elevated">
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Total reviews</p>
            <p style={{ fontSize: 32, margin: 0, fontFamily: 'var(--font-mono)' }}>{reviewCount ?? 0}</p>
            <Link href={`/s/${s.slug}/rate`}>Share your review link →</Link>
          </div>
          <div className="card card-elevated">
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Store visits 👀</p>
            <p style={{ fontSize: 32, margin: 0, fontFamily: 'var(--font-mono)' }}>{visitsAll ?? 0}</p>
            <span className="muted" style={{ fontSize: 13.5, display: 'block', margin: '2px 0 6px' }}>+{visits30 ?? 0} in the last 30 days</span>
            <Link href="/dashboard/analytics">Full analytics →</Link>
          </div>
        </div>
      </section>

      {/* ——— Section 3: Verification ——— */}
      <section className="dash-section" aria-labelledby="sec-verify">
        <div className="dash-section-head">
          <h2 id="sec-verify">Verification</h2>
          <span className="muted">30+ reviews at 4★ average earns the blue tick</span>
        </div>
        <div className="dash-panel">
          <VerifyCard
            reviewCount={stats?.review_count ?? 0}
            avgStars={stats?.avg_stars != null ? Number(stats.avg_stars) : null}
            status={(s.verification_status ?? 'unverified') as 'unverified' | 'verified'}
          />
        </div>
      </section>
    </main>
  );
}
