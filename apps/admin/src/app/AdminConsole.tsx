'use client';

import { useCallback, useEffect, useState } from 'react';
import { DonutChart, TrendBars, RankBars, AreaChart } from '@/components/Charts';

// Standalone port of the storefront AdminConsole — same sections and actions,
// but self-contained (inline naira/toggle helpers) and store links point at the
// marketplace deployment instead of relative /s/ routes.

interface Metrics {
  users: number;
  stores: number;
  listings: number;
  orders: number;
  reviews: number;
  newUsers24h: number;
  newStores7d: number;
  gmvKobo: number;
  paidOrders: number;
  banned: number;
  categories: Array<{ name: string; value: number }>;
  ordersByStatus: Array<{ name: string; value: number }>;
  signups14d: Array<{ day: string; sellers: number; customers: number }>;
  revenue30d: Array<{ day: string; kobo: number }>;
  mrr: {
    currentKobo: number;
    growthStores: number;
    months: Array<{ month: string; label: string; mrrKobo: number; stores: number }>;
  };
  funnel: {
    entered: number;
    reachedStep2: number;
    reachedStep3: number;
    published: number;
    abandoned: number;
    previewShown: number;
    topChips: Array<{ name: string; value: number }>;
  };
}

interface StoreDetail {
  store: StoreRow & { address?: string | null; avg_stars?: number | null };
  stats: {
    visitsAll: number;
    visits30d: number;
    listingViews: number;
    shares: number;
    chatsStarted: number;
    listings: number;
    ordersTotal: number;
    ordersByStatus: Record<string, number>;
    gmvKobo: number;
    visitDays: Array<{ day: string; visits: number }>;
    recentReviews: Array<{ stars: number; comment: string; created_at: string }>;
  };
}

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  store_name: string | null;
  store_slug: string | null;
  order_count: number;
  review_count: number;
  banned: boolean;
  ban_reason: string | null;
}

interface ReviewRow {
  id: string;
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  stars: number;
  comment: string;
  customer_phone: string;
  created_at: string;
}

interface ListingRow {
  id: string;
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  type: string;
  title: string;
  price_kobo: number | string;
  stock: number | null;
  created_at: string;
}

interface DiscountRow {
  id: string;
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  code: string;
  percent_off: number;
  active: boolean;
  usage_count: number;
  max_uses: number | null;
  created_at: string;
}

interface SearchResult {
  kind: 'user' | 'store' | 'listing' | 'order';
  id: string;
  title: string;
  sub: string;
}

interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  created_at: string;
}

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  business_type: string;
  verification_status: 'unverified' | 'verified';
  is_dropshipper: boolean;
  created_at: string;
  owner_id: string;
  review_count: number;
  avg_stars: number | null;
}

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'https://naijacart-roan.vercel.app';

const SECTIONS = [
  { key: 'overview', label: 'Overview', ico: '◧' },
  { key: 'analytics', label: 'Analytics', ico: '◔' },
  { key: 'accounts', label: 'Accounts', ico: '◉' },
  { key: 'stores', label: 'Stores', ico: '🏪' },
  { key: 'moderation', label: 'Moderation', ico: '⚖' },
  { key: 'discounts', label: 'Discounts', ico: '%' },
  { key: 'search', label: 'Search', ico: '⌕' },
  { key: 'audit', label: 'Audit log', ico: '≡' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

type NumericMetricKey = 'users' | 'newUsers24h' | 'stores' | 'newStores7d' | 'gmvKobo' | 'paidOrders' | 'listings' | 'reviews' | 'banned';

const METRIC_META: Array<{ key: NumericMetricKey; label: string; hint: string; money?: boolean; ico: string; tone: 'blue' | 'green' | 'amber' | 'red' }> = [
  { key: 'users', label: 'Total accounts', hint: 'sellers + customers', ico: '👥', tone: 'blue' },
  { key: 'newUsers24h', label: 'New (24h)', hint: 'signups today', ico: '✨', tone: 'green' },
  { key: 'stores', label: 'Stores', hint: 'all storefronts', ico: '🏪', tone: 'blue' },
  { key: 'newStores7d', label: 'New stores (7d)', hint: 'this week', ico: '🌱', tone: 'green' },
  { key: 'gmvKobo', label: 'GMV (paid)', hint: 'all paid orders', money: true, ico: '💰', tone: 'amber' },
  { key: 'paidOrders', label: 'Paid orders', hint: 'lifetime', ico: '🧾', tone: 'green' },
  { key: 'listings', label: 'Listings', hint: 'products + services', ico: '📦', tone: 'blue' },
  { key: 'reviews', label: 'Reviews', hint: 'all ratings', ico: '⭐', tone: 'amber' },
  { key: 'banned', label: 'Banned', hint: 'active bans', ico: '🚫', tone: 'red' },
];

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('ac-theme', next);
    } catch {
      // Private mode — theme just won't persist.
    }
  }

  const dark = mounted && theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle-compact"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {!mounted ? (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : dark ? (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 3v2.1M12 18.9V21M21 12h-2.1M5.1 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 13.2A8.1 8.1 0 0 1 10.8 3.5a8.1 8.1 0 1 0 9.7 9.7Z" />
        </svg>
      )}
    </button>
  );
}

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [section, setSection] = useState<SectionKey>('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'seller' | 'customer'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeQ, setStoreQ] = useState('');
  const [auditAction, setAuditAction] = useState('all');
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [modQ, setModQ] = useState('');
  const [modBusy, setModBusy] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPercent, setNewPercent] = useState('10');
  const [newStoreId, setNewStoreId] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');

  const reviewCountByStore = new Map(stores.map((s) => [s.id, s.review_count] as const));
  const filteredStores = storeQ
    ? stores.filter((s) => s.name.toLowerCase().includes(storeQ.toLowerCase()) || s.slug.includes(storeQ.toLowerCase()))
    : stores;
  const auditActions = Array.from(new Set(auditLog.map((e) => e.action)));
  const shownAudit = auditAction === 'all' ? auditLog : auditLog.filter((e) => e.action === auditAction);

  async function openDetail(s: StoreRow) {
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/admin/stores/${s.id}`);
      const body = await res.json();
      if (res.ok && !body.error) setDetail(body as StoreDetail);
      else setNotice({ kind: 'err', msg: body?.error?.message ?? 'Could not load store details.' });
    } finally {
      setDetailBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [m, u, s, a, r, l, d] = await Promise.all([
      fetch('/api/admin/metrics').then((r) => r.json()),
      fetch(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`).then((r) => r.json()),
      fetch('/api/admin/stores').then((r) => r.json()),
      fetch('/api/admin/audit').then((r) => r.json()),
      fetch('/api/admin/reviews').then((r) => r.json()),
      fetch('/api/admin/listings').then((r) => r.json()),
      fetch('/api/admin/discounts').then((r) => r.json()),
    ]);
    // apiOk unwraps to the payload itself on success; error shapes carry {error}.
    if (m && !m.error) setMetrics(m.data ?? m);
    if (u && !u.error) setUsers((u.data?.users ?? u.users) ?? []);
    if (s && !s.error) setStores((s.data?.stores ?? s.stores) ?? []);
    if (a && !a.error) setAuditLog((a.data?.entries ?? a.entries) ?? []);
    if (r && !r.error) setReviews((r.data?.reviews ?? r.reviews) ?? []);
    if (l && !l.error) setListings((l.data?.listings ?? l.listings) ?? []);
    if (d && !d.error) setDiscounts((d.data?.discounts ?? d.discounts) ?? []);
    setLoading(false);
  }, [q, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(user: UserRow, action: 'ban' | 'unban' | 'delete' | 'force_logout') {
    setBusyId(user.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'ban' ? `Banned by ${adminEmail}` : undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setNotice({ kind: 'err', msg: body?.error?.message ?? 'Action failed.' });
      } else {
        setNotice({ kind: 'ok', msg: `${action} → ${user.email ?? user.id}` });
        if (action === 'delete') setConfirmDelete(null);
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function modAction(kind: 'review' | 'listing', id: string) {
    setModBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/${kind}s`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, reason: `Removed by ${adminEmail}` }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setNotice({ kind: 'err', msg: body?.error?.message ?? 'Action failed.' });
      } else {
        setNotice({ kind: 'ok', msg: `${kind} ${id.slice(0, 8)} removed` });
        await load();
      }
    } finally {
      setModBusy(null);
    }
  }

  async function discountAction(action: 'activate' | 'deactivate', id: string) {
    setModBusy(id);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setNotice({ kind: 'err', msg: body?.error?.message ?? 'Action failed.' });
      } else {
        setNotice({ kind: 'ok', msg: `coupon ${action}d` });
        await load();
      }
    } finally {
      setModBusy(null);
    }
  }

  async function createCoupon() {
    setNotice(null);
    const body = await fetch('/api/admin/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        code: newCode,
        percent_off: Number(newPercent),
        store_id: newStoreId,
        max_uses: newMaxUses ? Number(newMaxUses) : undefined,
      }),
    }).then((r) => r.json());
    if (!body.ok) {
      setNotice({ kind: 'err', msg: body?.error?.message ?? 'Could not create coupon.' });
    } else {
      setNotice({ kind: 'ok', msg: `Coupon ${newCode.toUpperCase()} created` });
      setNewCode('');
      setNewMaxUses('');
      await load();
    }
  }

  async function runSearch() {
    setSearchBusy(true);
    try {
      const body = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQ)}`).then((r) => r.json());
      if (body && !body.error) setSearchResults((body.data?.results ?? body.results) ?? []);
      else setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }

  const filteredReviews = modQ
    ? reviews.filter((r) => (r.comment ?? '').toLowerCase().includes(modQ.toLowerCase()) || (r.store_name ?? '').toLowerCase().includes(modQ.toLowerCase()))
    : reviews;
  const filteredListings = modQ
    ? listings.filter((l) => l.title.toLowerCase().includes(modQ.toLowerCase()) || (l.store_name ?? '').toLowerCase().includes(modQ.toLowerCase()))
    : listings;

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/signin';
  }

  async function storeAction(store: StoreRow, action: 'verify' | 'unverify') {
    setBusyId(store.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/stores/${store.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setNotice({ kind: 'err', msg: body?.error?.message ?? 'Action failed.' });
      } else {
        setNotice({ kind: 'ok', msg: `${action} → ${store.name}` });
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-shell">
      {/* Top navbar: brand + identity + refresh */}
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-logo">Naija<span>vend</span></span>
          <span className="admin-topbar-divider" aria-hidden />
          <span className="admin-topbar-title">Control</span>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-topbar-identity" title={adminEmail}>{adminEmail}</span>
          <ThemeToggle />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <a className="btn btn-outline btn-sm" href="/api/admin/export" download>
            Export CSV
          </a>
          <button type="button" className="btn btn-outline btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-body">
        {/* Sidebar: section switcher (horizontal tab bar on phones) */}
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav" aria-label="Admin sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`admin-sidebar-link ${section === s.key ? 'is-active' : ''}`}
                aria-current={section === s.key ? 'page' : undefined}
                onClick={() => setSection(s.key)}
              >
                <span className="admin-sidebar-ico" aria-hidden>{s.ico}</span>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-foot">Superadmin</div>
        </aside>

        {/* Active section */}
        <main className="admin-main">
          {notice && (
            <div className={`alert ${notice.kind === 'ok' ? 'alert-success' : 'alert-error'}`} role="status">
              {notice.msg}
            </div>
          )}

          {section === 'overview' && (
            <section aria-label="Platform overview">
              <div className="admin-section-head">
                <h2>Overview</h2>
                <p className="admin-section-sub">Platform health at a glance — updated {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}.</p>
              </div>
              {!metrics ? (
                <div className="admin-metrics">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="admin-metric skeleton" style={{ height: 92 }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Hero band: money first — GMV, paid orders, MRR, conversion */}
                  <div className="ov-hero">
                    <div className="ov-hero-main">
                      <span className="ov-hero-label">Paid GMV — lifetime</span>
                      <span className="ov-hero-value">{formatNaira(metrics.gmvKobo)}</span>
                      <span className="ov-hero-sub">
                        {metrics.paidOrders.toLocaleString()} paid order{metrics.paidOrders === 1 ? '' : 's'}
                        {metrics.orders > 0 ? ` · ${Math.round((metrics.paidOrders / metrics.orders) * 100)}% of all orders` : ''}
                      </span>
                    </div>
                    <div className="ov-hero-side">
                      <div className="ov-hero-cell">
                        <span className="ov-hero-cell-value">{formatNaira(metrics.mrr?.currentKobo ?? 0)}</span>
                        <span className="ov-hero-cell-label">MRR · {metrics.mrr?.growthStores ?? 0} growth stores</span>
                      </div>
                      <div className="ov-hero-cell">
                        <span className="ov-hero-cell-value">{metrics.stores.toLocaleString()}</span>
                        <span className="ov-hero-cell-label">stores · +{metrics.newStores7d} this week</span>
                      </div>
                      <div className="ov-hero-cell">
                        <span className="ov-hero-cell-value">{metrics.users.toLocaleString()}</span>
                        <span className="ov-hero-cell-label">accounts · +{metrics.newUsers24h} today</span>
                      </div>
                    </div>
                  </div>

                  {/* Revenue trend inline under the hero */}
                  <div className="chart-card" style={{ marginBottom: 18 }}>
                    <h3>Paid revenue — last 30 days</h3>
                    <p className="chart-sub">Daily GMV from paid + fulfilled orders</p>
                    <AreaChart
                      points={metrics.revenue30d.map((d) => ({ day: d.day, value: d.kobo }))}
                      money
                      label="Paid revenue per day"
                    />
                  </div>

                  {/* Remaining KPIs in a compact strip */}
                  <div className="admin-metrics" style={{ marginBottom: 18 }}>
                    {METRIC_META.filter((m) => !['gmvKobo', 'paidOrders', 'stores', 'users'].includes(m.key)).map((m) => (
                      <div key={m.key} className={`admin-metric tone-${m.tone}`}>
                        <span className="admin-metric-ico" aria-hidden>{m.ico}</span>
                        <span className="admin-metric-value">
                          {m.money ? formatNaira(metrics[m.key]) : metrics[m.key].toLocaleString()}
                        </span>
                        <span className="admin-metric-label">{m.label}</span>
                        <span className="admin-metric-hint">{m.hint}</span>
                      </div>
                    ))}
                  </div>

                  {/* Glanceable charts + jump-off points */}
                  <div className="chart-grid-2">
                    <div className="chart-card">
                      <h3>Stores by category</h3>
                      <p className="chart-sub">All storefronts on the platform</p>
                      <DonutChart slices={metrics.categories} />
                    </div>
                    <div className="chart-card">
                      <h3>Orders by status</h3>
                      <p className="chart-sub">Lifetime order pipeline</p>
                      <DonutChart slices={metrics.ordersByStatus} />
                    </div>
                    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                      <h3>Signups — last 14 days</h3>
                      <p className="chart-sub">Daily new seller vs customer accounts</p>
                      <TrendBars days={metrics.signups14d} />
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {section === 'analytics' && metrics && (
            <section aria-label="Platform analytics">
              <div className="admin-section-head">
                <h2>Analytics</h2>
                <p className="admin-section-sub">Where the platform's activity comes from.</p>
              </div>
              <div className="chart-grid-2">
                <div className="chart-card chart-hero" style={{ gridColumn: '1 / -1' }}>
                  <div className="chart-hero-head">
                    <div>
                      <h3>Monthly recurring revenue (MRR)</h3>
                      <p className="chart-sub">
                        Growth-plan stores × ₦500/mo · {metrics.mrr?.growthStores ?? 0} growth store{((metrics.mrr?.growthStores ?? 0) === 1) ? '' : 's'}
                      </p>
                    </div>
                    <div className="chart-hero-stat">
                      <span className="chart-hero-value">{formatNaira(metrics.mrr?.currentKobo ?? 0)}</span>
                      <span className="chart-hero-label">current MRR</span>
                    </div>
                  </div>
                  <AreaChart
                    points={(metrics.mrr?.months ?? []).map((m) => ({ day: m.label, value: m.mrrKobo }))}
                    money
                    label="Monthly recurring revenue, last 7 months"
                  />
                </div>
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                  <h3>Paid revenue — last 30 days</h3>
                  <p className="chart-sub">Daily GMV from paid + fulfilled orders · total {formatNaira(metrics.gmvKobo)}</p>
                  <AreaChart
                    points={metrics.revenue30d.map((d) => ({ day: d.day, value: d.kobo }))}
                    money
                    label="Paid revenue per day"
                  />
                </div>
                <div className="chart-card">
                  <h3>Stores by category</h3>
                  <p className="chart-sub">All storefronts on the platform</p>
                  <DonutChart slices={metrics.categories} />
                </div>
                <div className="chart-card">
                  <h3>Orders by status</h3>
                  <p className="chart-sub">Lifetime order pipeline</p>
                  <DonutChart slices={metrics.ordersByStatus} />
                </div>
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                  <h3>Signups — last 14 days</h3>
                  <p className="chart-sub">Daily new seller vs customer accounts</p>
                  <TrendBars days={metrics.signups14d} />
                </div>
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                  <h3>Onboarding funnel — last 30 days</h3>
                  <p className="chart-sub">
                    Where sellers drop off between opening the wizard and publishing a store.
                  </p>
                  <div className="funnel-steps" role="list" aria-label="Onboarding funnel steps">
                    {([
                      ['Started setup', metrics.funnel.entered],
                      ['Reached AI draft (step 2)', metrics.funnel.reachedStep2],
                      ['Reached store link (step 3)', metrics.funnel.reachedStep3],
                      ['Published a store', metrics.funnel.published],
                    ] as const).map(([label, value], i, arr) => {
                      const prev = i === 0 ? null : arr[i - 1][1];
                      const pct = metrics.funnel.entered > 0 ? Math.round((value / metrics.funnel.entered) * 100) : 0;
                      const drop = prev != null && prev > 0 ? Math.round((1 - value / prev) * 100) : null;
                      return (
                        <div key={label} className="funnel-step" role="listitem">
                          <div className="funnel-step-head">
                            <strong>{label}</strong>
                            <span className="funnel-step-val">{value.toLocaleString()}</span>
                          </div>
                          <div className="funnel-bar-track">
                            <div className="funnel-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="funnel-step-sub">
                            {pct}% of started{drop != null && drop > 0 ? ` · ${drop}% lost since previous` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="chart-sub" style={{ marginTop: 10 }}>
                    {metrics.funnel.abandoned} abandoned after starting · live AI preview seen by{' '}
                    {metrics.funnel.previewShown.toLocaleString()}
                  </p>
                </div>
                {metrics.funnel.topChips.length > 0 && (
                  <div className="chart-card">
                    <h3>Most-used quick-add chips</h3>
                    <p className="chart-sub">What sellers tap instead of typing</p>
                    <RankBars items={metrics.funnel.topChips} />
                  </div>
                )}
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                  <h3>Top stores by reviews</h3>
                  <p className="chart-sub">Customer engagement ranking</p>
                  <RankBars
                    items={[...stores]
                      .sort((a, b) => (reviewCountByStore.get(b.id) ?? 0) - (reviewCountByStore.get(a.id) ?? 0))
                      .slice(0, 8)
                      .map((s) => ({ name: s.name, value: reviewCountByStore.get(s.id) ?? 0 }))
                      .filter((i) => i.value > 0)}
                  />
                </div>
              </div>
            </section>
          )}

          {section === 'accounts' && (
            <section className="admin-users" aria-label="Accounts directory">
              <div className="admin-section-head">
                <h2>Accounts</h2>
                <p className="admin-section-sub">{users.length} shown — search, ban or delete.</p>
              </div>
              <div className="admin-filters">
                <input
                  type="search"
                  placeholder="Search by email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search users by email"
                />
                <div className="admin-role-tabs" role="tablist">
                  {(['all', 'seller', 'customer'] as const).map((r) => (
                    <button key={r} type="button" role="tab" aria-selected={role === r} className={role === r ? 'is-active' : ''} onClick={() => setRole(r)}>
                      {r === 'all' ? 'All' : r === 'seller' ? 'Sellers' : 'Customers'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Activity</th>
                      <th>Last seen</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={u.banned ? 'is-banned' : ''}>
                        <td>
                          <span className="admin-user-email">{u.email ?? u.id.slice(0, 8)}</span>
                          {u.store_name && (
                            <a className="admin-user-store" href={`${MARKETPLACE_URL}/s/${u.store_slug}`} target="_blank" rel="noreferrer">
                              {u.store_name}
                            </a>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'seller' ? 'badge-blue' : 'badge-black'}`}>{u.role}</span>
                        </td>
                        <td className="admin-activity">
                          {u.role === 'seller' ? '—' : `${u.order_count} orders`}
                          {u.review_count > 0 && ` · ${u.review_count} reviews`}
                        </td>
                        <td>{timeAgo(u.last_sign_in_at)}</td>
                        <td>
                          {u.banned ? (
                            <span className="badge badge-danger" title={u.ban_reason ?? undefined}>
                              Banned
                            </span>
                          ) : (
                            <span className="badge badge-success">Active</span>
                          )}
                        </td>
                        <td className="admin-actions">
                          {u.banned ? (
                            <button type="button" className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => act(u, 'unban')}>
                              Unban
                            </button>
                          ) : (
                            <button type="button" className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => act(u, 'ban')}>
                              Ban
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            title="Revoke all active sessions for this account"
                            disabled={busyId === u.id}
                            onClick={() => act(u, 'force_logout')}
                          >
                            ⎋ Logout
                          </button>
                          {!u.banned && (
                            <button
                              type="button"
                              className="btn btn-sm admin-delete-btn"
                              disabled={busyId === u.id}
                              onClick={() => {
                                setConfirmDelete(u);
                                setConfirmText('');
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="admin-empty">
                          No accounts match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'stores' && (
            <section className="admin-users" aria-label="Stores directory">
              <div className="admin-section-head">
                <h2>Stores</h2>
                <p className="admin-section-sub">{filteredStores.length} of {stores.length} stores — click a row for full analytics.</p>
              </div>
              <div className="admin-filters">
                <input
                  type="search"
                  placeholder="Search stores…"
                  value={storeQ}
                  onChange={(e) => setStoreQ(e.target.value)}
                  aria-label="Search stores"
                />
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Reviews</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="admin-user-email">{s.name}</span>
                          <a className="admin-store-slug" href={`${MARKETPLACE_URL}/s/${s.slug}`} target="_blank" rel="noreferrer">
                            /s/{s.slug} ↗
                          </a>
                        </td>
                        <td><span className="badge badge-blue">{s.category}</span></td>
                        <td>{s.business_type}{s.is_dropshipper ? ' · 🚚' : ''}</td>
                        <td>
                          {s.review_count > 0 ? (
                            <span title={`${s.avg_stars?.toFixed(1) ?? '—'} average`}>⭐ {s.review_count}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{timeAgo(s.created_at)}</td>
                        <td>
                          {s.verification_status === 'verified' ? (
                            <span className="badge badge-success">Verified</span>
                          ) : (
                            <span className="badge">Unverified</span>
                          )}
                        </td>
                        <td className="admin-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={detailBusy}
                            onClick={() => openDetail(s)}
                          >
                            📊 Stats
                          </button>
                          {s.verification_status === 'verified' ? (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={busyId === s.id}
                              onClick={() => storeAction(s, 'unverify')}
                            >
                              Unverify
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={busyId === s.id}
                              onClick={() => storeAction(s, 'verify')}
                            >
                              ✓ Verify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {stores.length === 0 && (
                      <tr>
                        <td colSpan={7} className="admin-empty">No stores.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'moderation' && (
            <section className="admin-users" aria-label="Moderation queues">
              <div className="admin-section-head">
                <h2>Moderation</h2>
                <p className="admin-section-sub">Trust &amp; safety — reviews and listings across all stores.</p>
              </div>
              <div className="admin-filters">
                <input
                  type="search"
                  placeholder="Filter by text or store…"
                  value={modQ}
                  onChange={(e) => setModQ(e.target.value)}
                  aria-label="Filter moderation items"
                />
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Review</th>
                      <th>Store</th>
                      <th>When</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</strong>
                          <span className="muted"> {r.comment ? r.comment.slice(0, 90) : '(no comment)'}</span>
                        </td>
                        <td>
                          <a href={`${MARKETPLACE_URL}/s/${r.store_slug}`} target="_blank" rel="noreferrer">{r.store_name ?? r.store_id.slice(0, 8)}</a>
                        </td>
                        <td>{timeAgo(r.created_at)}</td>
                        <td className="admin-actions">
                          <button type="button" className="btn btn-outline btn-sm admin-delete-btn" disabled={modBusy === r.id} onClick={() => modAction('review', r.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredReviews.length === 0 && (
                      <tr><td colSpan={4} className="admin-empty">No reviews.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-table-wrap" style={{ marginTop: 24 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Store</th>
                      <th>Price</th>
                      <th>Created</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="admin-user-email">{l.title}</span>
                          <span className="badge badge-blue" style={{ marginLeft: 8 }}>{l.type}</span>
                        </td>
                        <td>
                          <a href={`${MARKETPLACE_URL}/s/${l.store_slug}`} target="_blank" rel="noreferrer">{l.store_name ?? l.store_id.slice(0, 8)}</a>
                        </td>
                        <td>{formatNaira(Number(l.price_kobo))}</td>
                        <td>{timeAgo(l.created_at)}</td>
                        <td className="admin-actions">
                          <button type="button" className="btn btn-outline btn-sm admin-delete-btn" disabled={modBusy === l.id} onClick={() => modAction('listing', l.id)}>
                            Takedown
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredListings.length === 0 && (
                      <tr><td colSpan={5} className="admin-empty">No listings.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'discounts' && (
            <section className="admin-users" aria-label="Discount codes">
              <div className="admin-section-head">
                <h2>Discounts &amp; coupons</h2>
                <p className="admin-section-sub">Platform-wide coupon directory — create, pause or resume.</p>
              </div>

              <div className="admin-filters" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <label htmlFor="new-code" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Code</label>
                  <input id="new-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="SUMMER25" style={{ width: 150 }} />
                </div>
                <div>
                  <label htmlFor="new-percent" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>% off (1–90)</label>
                  <input id="new-percent" value={newPercent} onChange={(e) => setNewPercent(e.target.value)} inputMode="numeric" style={{ width: 90 }} />
                </div>
                <div>
                  <label htmlFor="new-store" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Store</label>
                  <select id="new-store" value={newStoreId} onChange={(e) => setNewStoreId(e.target.value)} style={{ width: 200 }}>
                    <option value="">Pick a store…</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-max" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Max uses (optional)</label>
                  <input id="new-max" value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} inputMode="numeric" placeholder="∞" style={{ width: 90 }} />
                </div>
                <button type="button" className="btn btn-sm" disabled={!newCode || !newStoreId} onClick={createCoupon}>
                  Create coupon
                </button>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Store</th>
                      <th>Discount</th>
                      <th>Usage</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((d) => (
                      <tr key={d.id}>
                        <td><code>{d.code}</code></td>
                        <td>{d.store_name ?? d.store_id.slice(0, 8)}</td>
                        <td>{d.percent_off}%</td>
                        <td>{d.usage_count}{d.max_uses ? ` / ${d.max_uses}` : ''}</td>
                        <td>{d.active ? <span className="badge badge-success">Active</span> : <span className="badge">Paused</span>}</td>
                        <td className="admin-actions">
                          {d.active ? (
                            <button type="button" className="btn btn-outline btn-sm" disabled={modBusy === d.id} onClick={() => discountAction('deactivate', d.id)}>
                              Pause
                            </button>
                          ) : (
                            <button type="button" className="btn btn-outline btn-sm" disabled={modBusy === d.id} onClick={() => discountAction('activate', d.id)}>
                              Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {discounts.length === 0 && (
                      <tr><td colSpan={6} className="admin-empty">No discount codes yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'search' && (
            <section className="admin-users" aria-label="Global search">
              <div className="admin-section-head">
                <h2>Global search</h2>
                <p className="admin-section-sub">Accounts, stores, listings and orders — all in one place.</p>
              </div>
              <div className="admin-filters">
                <input
                  type="search"
                  placeholder="Search email, store, listing, order…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  aria-label="Global search query"
                  style={{ maxWidth: 420 }}
                />
                <button type="button" className="btn btn-sm" disabled={searchBusy || searchQ.trim().length < 2} onClick={runSearch}>
                  {searchBusy ? 'Searching…' : 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Type</th><th>Result</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                      {searchResults.map((r) => (
                        <tr key={`${r.kind}-${r.id}`}>
                          <td><span className={`badge ${r.kind === 'user' ? 'badge-black' : r.kind === 'store' ? 'badge-blue' : 'badge-success'}`}>{r.kind}</span></td>
                          <td><span className="admin-user-email">{r.title}</span></td>
                          <td className="muted">{r.sub}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!searchBusy && searchQ.trim().length >= 2 && searchResults.length === 0 && <p className="muted">No matches.</p>}
            </section>
          )}

          {section === 'audit' && (
            <section className="admin-audit" aria-label="Audit log">
              <div className="admin-section-head">
                <h2>Audit log</h2>
                <p className="admin-section-sub">Every admin action, newest first.</p>
              </div>
              {auditLog.length === 0 ? (
                <p className="muted">No admin actions recorded yet.</p>
              ) : (
                <ul>
                  {shownAudit.map((e) => (
                    <li key={e.id}>
                      <span className={`badge ${e.action === 'delete' ? 'badge-danger' : e.action === 'ban' ? 'badge-black' : 'badge-success'}`}>{e.action}</span>
                      <strong>{e.actor_email}</strong> → {e.target_email ?? e.target_user_id}
                      <time>{timeAgo(e.created_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Store drill-down: full per-store analytics */}
      {detail && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${detail.store.name} analytics`} onClick={() => setDetail(null)}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>{detail.store.name}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {detail.store.category} · {detail.store.business_type} ·{' '}
                  <a href={`${MARKETPLACE_URL}/s/${detail.store.slug}`} target="_blank" rel="noreferrer">/s/{detail.store.slug} ↗</a>
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetail(null)} aria-label="Close">×</button>
            </div>

            <div className="detail-stats">
              <div className="detail-stat"><strong>{detail.stats.visitsAll.toLocaleString()}</strong><span>Visits (all)</span></div>
              <div className="detail-stat"><strong>{detail.stats.visits30d.toLocaleString()}</strong><span>Visits (30d)</span></div>
              <div className="detail-stat"><strong>{detail.stats.listingViews.toLocaleString()}</strong><span>Product views</span></div>
              <div className="detail-stat"><strong>{detail.stats.shares.toLocaleString()}</strong><span>Shares</span></div>
              <div className="detail-stat"><strong>{detail.stats.chatsStarted.toLocaleString()}</strong><span>Chats</span></div>
              <div className="detail-stat"><strong>{detail.stats.listings.toLocaleString()}</strong><span>Listings</span></div>
              <div className="detail-stat"><strong>{detail.stats.ordersTotal.toLocaleString()}</strong><span>Orders</span></div>
              <div className="detail-stat"><strong>{formatNaira(detail.stats.gmvKobo)}</strong><span>GMV (paid)</span></div>
            </div>

            <div className="detail-orders muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>
              {Object.entries(detail.stats.ordersByStatus).map(([k, v]) => (
                <span key={k} className="badge" style={{ marginRight: 6 }}>{k}: {v}</span>
              ))}
            </div>

            {detail.stats.visitDays.some((d) => d.visits > 0) && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 6px' }}>Visits — last 14 days</p>
                <AreaChart points={detail.stats.visitDays.map((d) => ({ day: d.day, value: d.visits }))} height={120} label="Visits per day" />
              </div>
            )}

            {detail.stats.recentReviews.length > 0 && (
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 6px' }}>Recent reviews</p>
                <ul className="detail-reviews">
                  {detail.stats.recentReviews.slice(0, 5).map((r, i) => (
                    <li key={i}>
                      <strong>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</strong>
                      <span className="muted"> {r.comment ? r.comment.slice(0, 120) : '(no comment)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation — type-to-confirm (destructive-action pattern) */}
      {confirmDelete && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="admin-modal">
            <h3>Delete account permanently?</h3>
            <p>
              This removes <strong>{confirmDelete.email}</strong>
              {confirmDelete.role === 'seller' && confirmDelete.store_name ? (
                <>
                  {' '}
                  and their store <strong>{confirmDelete.store_name}</strong> with all listings, orders and reviews
                </>
              ) : (
                <> and all their orders and reviews</>
              )}
              . This cannot be undone.
            </p>
            <label htmlFor="confirm-input">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn admin-delete-btn"
                disabled={confirmText !== 'DELETE' || busyId === confirmDelete.id}
                onClick={() => act(confirmDelete, 'delete')}
              >
                {busyId === confirmDelete.id ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
