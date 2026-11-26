import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  Eye,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Star,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { siteUrl } from '@/lib/site';
import { Stars } from '@/components/Stars';
import { VerifyCard } from './VerifyCard';
import { SetupChecklist } from './SetupChecklist';
import { StoreQrCode } from '@/components/StoreQrCode';
import { CategoryIcon } from '@/lib/categories';
import { categoryLabel, formatNaira, isOpenNow, orderRef } from '@idevtenancy/shared';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Normalises PostgREST embeds: one-to-one comes back as an object, one-to-many as an array.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const DAY = 24 * 60 * 60 * 1000;

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Honest trend: only shown when there is a previous period to compare with. */
function Trend({ now, prev }: { now: number; prev: number }) {
  if (prev <= 0) return now > 0 ? <span className="dh-trend is-flat">New this month</span> : null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <span className="dh-trend is-flat">Same as last 30 days</span>;
  const up = pct > 0;
  return (
    <span className={`dh-trend ${up ? 'is-up' : 'is-down'}`}>
      {up ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}
      {Math.abs(pct)}% vs previous 30 days
    </span>
  );
}

const STATUS: Record<string, { label: string; tone: string; icon: LucideIcon }> = {
  pending: { label: 'Pending', tone: 'warning', icon: CalendarClock },
  paid: { label: 'Paid (confirmed)', tone: 'success', icon: CircleCheck },
  fulfilled: { label: 'Completed', tone: 'success', icon: Package },
  cancelled: { label: 'Cancelled', tone: 'danger', icon: Receipt },
};

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: { created?: string };
}) {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  await redirectStaffToPos(sb); // R4: staff never render owner pages
  const store = await getOwnStore<
    Store & { store_rating_stats: StoreRatingStats[] | StoreRatingStats | null; store_themes: StoreTheme[] | StoreTheme | null }
  >(sb, '*, store_rating_stats(review_count, avg_stars, overall_rank, category_rank), store_themes(*)');

  if (!store) {
    return (
      <main className="dh">
        {searchParams.created && <div className="alert alert-success">Store created. Finish setup below.</div>}
        <section className="dh-empty">
          <span className="dh-empty-ico" aria-hidden>
            <ShoppingBag size={28} />
          </span>
          <h1>Welcome to Kwaravend</h1>
          <p className="muted">You&apos;re signed in but haven&apos;t created a store yet. It takes a few minutes and it&apos;s free.</p>
          <Link href="/dashboard/onboarding" className="btn btn-primary btn-lg">
            <Plus size={18} aria-hidden /> Set up my store
          </Link>
        </section>
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

  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const since60 = new Date(Date.now() - 60 * DAY).toISOString();
  const listingIds = (await sb.from('listings').select('id').eq('store_id', s.id)).data?.map((l) => l.id) ?? [];

  const [
    { count: pendingOrders },
    { count: awaitingPayment },
    { count: paidOrders },
    { count: pendingBookings },
    { count: visitsAll },
    { count: visits30 },
    { count: visitsPrev },
    sales60,
    recentRes,
  ] = await Promise.all([
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('status', 'pending'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('payment_status', 'awaiting_confirmation'),
    // All-time money-in orders. Fulfilled orders were paid first, so both count toward the first-10 milestone.
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', s.id).in('status', ['paid', 'fulfilled']),
    sb.from('bookings').select('*', { count: 'exact', head: true }).in('listing_id', listingIds).eq('status', 'pending'),
    sb.from('store_events').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('event_type', 'view'),
    sb.from('store_events').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('event_type', 'view').gte('created_at', since30),
    sb.from('store_events').select('*', { count: 'exact', head: true }).eq('store_id', s.id).eq('event_type', 'view').gte('created_at', since60).lt('created_at', since30),
    sb.from('store_sales_daily').select('day, revenue_kobo').eq('store_id', s.id).gte('day', since60.slice(0, 10)),
    sb
      .from('orders')
      .select('id, customer_name, total_kobo, status, payment_status, created_at')
      .eq('store_id', s.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const cut = since30.slice(0, 10);
  let revenue30 = 0;
  let revenuePrev = 0;
  for (const r of sales60.data ?? []) {
    if (String(r.day) >= cut) revenue30 += Number(r.revenue_kobo ?? 0);
    else revenuePrev += Number(r.revenue_kobo ?? 0);
  }
  const paidOrderCount = paidOrders ?? 0;
  const reviewCount = stats?.review_count ?? 0;
  const avg = stats?.avg_stars != null ? Number(stats.avg_stars) : 0;
  const open = isOpenNow(s.business_hours);
  const recent = recentRes.data ?? [];


  const queue: Array<{ label: string; hint: string; count: number; href: string; icon: LucideIcon; tone: string }> = [
    { label: 'Orders to confirm', hint: 'New orders waiting for you', count: pendingOrders ?? 0, href: '/dashboard/orders', icon: ShoppingBag, tone: 'primary' },
    { label: 'Payments to check', hint: 'Buyers sent a transfer receipt', count: awaitingPayment ?? 0, href: '/dashboard/orders', icon: Wallet, tone: 'accent' },
    { label: 'Booking requests', hint: 'Appointments to accept', count: pendingBookings ?? 0, href: '/dashboard/bookings', icon: CalendarClock, tone: 'info' },
  ];
  const needsYou = queue.some((q) => q.count > 0);

  // Bank details live in their own owner-only table (null before the migration).
  const { data: bankRow } = await sb.from('store_bank_accounts').select('store_id').eq('store_id', s.id).maybeSingle();
  const deliveryOpts = (s as unknown as { delivery_options?: Record<string, { enabled?: boolean }> | null }).delivery_options ?? null;
  const hasDelivery = Boolean(deliveryOpts && Object.values(deliveryOpts).some((o) => o && typeof o === 'object' && (o as { enabled?: boolean }).enabled));

  const checklist = [
    { label: 'Store created', done: true, href: `/s/${s.slug}`, cta: 'View' },
    { label: 'Add your first 3 products', done: listingIds.length >= 3, href: '/dashboard/listings/bulk', cta: 'Bulk add' },
    { label: 'Add a logo', done: Boolean(logo), href: '/dashboard/settings', cta: 'Add logo' },
    { label: 'Set your WhatsApp number', done: Boolean(s.whatsapp_number), href: '/dashboard/settings', cta: 'Set number' },
    { label: 'Set your opening hours', done: Boolean(s.business_hours), href: '/dashboard/settings', cta: 'Set hours' },
    { label: 'Add bank details for transfers', done: Boolean(bankRow), href: '/dashboard/settings', cta: 'Add bank' },
    { label: 'Choose pickup or delivery', done: hasDelivery, href: '/dashboard/settings', cta: 'Set delivery' },
    {
      label: 'Get your first order',
      done: paidOrderCount > 0 || (pendingOrders ?? 0) > 0,
      href: '/dashboard/settings',
      cta: 'Share store',
    },
  ];
  const setupDone = checklist.every((c) => c.done);

  return (
    <main className="dh">
      {searchParams.created && <div className="alert alert-success">Store created. Finish setup below.</div>}

      {/* ---------------------------------------------------------- header */}
      <header className="dh-hero">
        <div className="dh-hero-id">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
            <img className="dh-logo" src={logo} alt="" />
          ) : (
            <span className="dh-logo is-fallback" aria-hidden>
              {s.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="dh-greet">{greeting()}</p>
            <h1>{s.name}</h1>
            <div className="dh-chips">
              <span className={`badge ${open ? 'badge-success' : ''}`}>
                <span className={`dh-dot${open ? ' is-open' : ''}`} aria-hidden /> {open ? 'Open now' : s.business_hours ? 'Closed now' : 'Hours not set'}
              </span>
              <span className="badge">
                <CategoryIcon category={s.category} size={13} /> {categoryLabel(s.category)}
              </span>
              {s.verification_status === 'verified' && (
                <span className="badge badge-primary">
                  <BadgeCheck size={13} aria-hidden /> Verified
                </span>
              )}
              {paidOrderCount >= 10 && (
                <span className="badge badge-warning" title={`${paidOrderCount} paid orders so far`}>
                  <Star size={13} aria-hidden /> First 10 orders
                </span>
              )}
              {s.address && (
                <span className="badge">
                  <MapPin size={13} aria-hidden /> {s.address}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="dh-actions">
          <Link className="btn btn-primary" href="/dashboard/listings">
            <Plus size={17} aria-hidden /> Add product
          </Link>
          <Link className="btn btn-outline" href={`/s/${s.slug}`} target="_blank">
            <ExternalLink size={16} aria-hidden /> View live store
          </Link>
          <Link className="btn btn-ghost" href="/dashboard/design">
            <Settings size={16} aria-hidden /> Look &amp; feel
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------- needs you */}
      <section aria-labelledby="dh-queue" className="dh-section">
        <div className="dh-section-head">
          <h2 id="dh-queue">Needs you now</h2>
          {!needsYou && (
            <span className="badge badge-success">
              <CircleCheck size={13} aria-hidden /> All caught up
            </span>
          )}
        </div>
        <div className="dh-queue">
          {queue.map((q) => (
            <Link key={q.label} href={q.href} className={`dh-queue-item tone-${q.tone}${q.count > 0 ? ' has-items' : ''}`}>
              <span className="dh-queue-ico" aria-hidden>
                <q.icon size={20} />
              </span>
              <span className="dh-queue-body">
                <strong>{q.label}</strong>
                <em>{q.hint}</em>
              </span>
              <span className="dh-queue-count" aria-label={`${q.count} ${q.label.toLowerCase()}`}>
                {q.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ KPIs */}
      <section aria-labelledby="dh-kpis" className="dh-section">
        <div className="dh-section-head">
          <h2 id="dh-kpis">Last 30 days</h2>
          <Link href="/dashboard/analytics" className="dh-more">
            Full analytics <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
        <div className="dh-kpis">
          <div className="dh-kpi">
            <span className="dh-kpi-ico tone-green" aria-hidden>
              <Wallet size={18} />
            </span>
            <span className="dh-kpi-label">Paid (confirmed by you)</span>
            <strong className="dh-kpi-value money-value">{formatNaira(revenue30)}</strong>
            <Trend now={revenue30} prev={revenuePrev} />
          </div>
          <div className="dh-kpi">
            <span className="dh-kpi-ico tone-primary" aria-hidden>
              <Eye size={18} />
            </span>
            <span className="dh-kpi-label">Store visits</span>
            <strong className="dh-kpi-value">{visits30 ?? 0}</strong>
            <Trend now={visits30 ?? 0} prev={visitsPrev ?? 0} />
            <span className="dh-kpi-foot">{visitsAll ?? 0} all time</span>
          </div>
          <div className="dh-kpi">
            <span className="dh-kpi-ico tone-accent" aria-hidden>
              <Star size={18} />
            </span>
            <span className="dh-kpi-label">Reviews</span>
            <strong className="dh-kpi-value">{reviewCount > 0 ? avg.toFixed(1) : '—'}</strong>
            {reviewCount > 0 ? <Stars value={avg} showNumeric={false} /> : null}
            <span className="dh-kpi-foot">
              {reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
              {stats?.overall_rank && reviewCount >= 3 ? ` · #${stats.overall_rank} overall` : ''}
            </span>
          </div>
          <div className="dh-kpi">
            <span className="dh-kpi-ico tone-info" aria-hidden>
              <Receipt size={18} />
            </span>
            <span className="dh-kpi-label">Paid orders, all time</span>
            <strong className="dh-kpi-value">{paidOrderCount}</strong>
            <span className="dh-kpi-foot">{listingIds.length} listing{listingIds.length === 1 ? '' : 's'} live</span>
          </div>
        </div>
      </section>

      <div className="dh-grid">
        {/* ------------------------------------------------- recent orders */}
        <section aria-labelledby="dh-recent" className="dh-section dh-card">
          <div className="dh-section-head">
            <h2 id="dh-recent">Recent orders</h2>
            <Link href="/dashboard/orders" className="dh-more">
              All orders <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="dh-empty-inline">
              <ShoppingBag size={22} aria-hidden />
              <p>No orders yet. Share your store link or QR code to get your first one.</p>
            </div>
          ) : (
            <ul className="dh-orders">
              {recent.map((o) => {
                const st = o.payment_status === 'awaiting_confirmation' ? { label: 'Check payment', tone: 'warning', icon: Wallet } : STATUS[o.status] ?? STATUS.pending;
                return (
                  <li key={o.id}>
                    <Link href="/dashboard/orders" className="dh-order">
                      <span className="dh-order-main">
                        <strong>{o.customer_name}</strong>
                        <em>
                          <code>{orderRef(o.id)}</code> · {ago(o.created_at)}
                        </em>
                      </span>
                      <span className={`badge badge-${st.tone}`}>
                        <st.icon size={12} aria-hidden /> {st.label}
                      </span>
                      <span className="dh-order-total">{formatNaira(Number(o.total_kobo))}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* -------------------------------------------------- side column */}
        <div className="dh-side">
          {!setupDone && (
            <section aria-label="Setup checklist" className="dh-card">
              <SetupChecklist steps={checklist} />
            </section>
          )}
          <section aria-labelledby="dh-share" className="dh-card">
            <div className="dh-section-head">
              <h2 id="dh-share">Share kit</h2>
            </div>
            <p className="muted dh-link-line">
              <Link href={`/s/${s.slug}`} target="_blank">
                {siteUrl().replace(/^https?:\/\//, '')}/s/{s.slug}
              </Link>
            </p>
            <StoreQrCode
              url={`${siteUrl()}/s/${s.slug}`}
              storeName={s.name}
              accent={theme?.accent_color ?? null}
              logoUrl={logo}
              variant="card"
              title="Store QR code"
            />
          </section>
          <section aria-labelledby="dh-verify" className="dh-card">
            <div className="dh-section-head">
              <h2 id="dh-verify">Blue tick</h2>
            </div>
            <VerifyCard
              reviewCount={reviewCount}
              avgStars={stats?.avg_stars != null ? Number(stats.avg_stars) : null}
              status={(s.verification_status ?? 'unverified') as 'unverified' | 'verified'}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
