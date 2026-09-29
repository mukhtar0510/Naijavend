import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { siteUrl } from '@/lib/site';
import { DailyChart, TopReferrers } from './Charts';
import { classifyTrafficSource, ownHostsFromSiteUrl } from '@idevtenancy/shared';
import type { Store, StoreEvent } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AnalyticsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<Pick<Store, 'id' | 'name' | 'slug'>>(sb, 'id, name, slug');
  if (!store) {
    return (
      <main>
        <h1>Analytics</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">Set up my store</Link>
      </main>
    );
  }

  const since = new Date(Date.now() - 29 * DAY_MS).toISOString();
  const [{ data: events }, { count: paidOrders }, { count: bookingsCount }] = await Promise.all([
    sb.from('store_events').select('*').eq('store_id', store.id).gte('created_at', since).limit(5000),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', store.id).in('status', ['paid', 'fulfilled']),
    sb.from('bookings').select('*', { count: 'exact', head: true })
      .in('listing_id', (await sb.from('listings').select('id').eq('store_id', store.id)).data?.map((l) => l.id) ?? [])
      .in('status', ['confirmed', 'completed']),
  ]);

  const rows = (events ?? []) as StoreEvent[];
  const views = rows.filter((r) => r.event_type === 'view');
  const listingViews = rows.filter((r) => r.event_type === 'listing_view');
  const shares = rows.filter((r) => r.event_type === 'share');
  const copies = rows.filter((r) => r.event_type === 'link_copy');
  const chats = rows.filter((r) => r.event_type === 'chat_started');

  // 14-day daily series (views + listing views).
  const days: Array<{ label: string; iso: string; visits: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS);
    days.push({
      label: day.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
      iso: day.toISOString().slice(0, 10),
      visits: 0,
    });
  }
  const byIso = new Map(days.map((d) => [d.iso, d]));
  for (const r of rows) {
    if (r.event_type !== 'view' && r.event_type !== 'listing_view') continue;
    const iso = r.created_at.slice(0, 10);
    const bucket = byIso.get(iso);
    if (bucket) bucket.visits += 1;
  }

  // Where visitors came from, folded into seller-readable groups (Home page,
  // Search, Link, named social apps). Raw hosts and the seller's own dev
  // traffic never reach this list — see classifyTrafficSource.
  const ownHosts = ownHostsFromSiteUrl(siteUrl());
  const refCounts = new Map<string, number>();
  let attributedViews = 0;
  for (const r of views) {
    const src = classifyTrafficSource(r.referrer, r.source, ownHosts);
    if (src.ignore) continue;
    refCounts.set(src.label, (refCounts.get(src.label) ?? 0) + 1);
    attributedViews += 1;
  }
  const topReferrers = [...refCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalVisits = views.length + listingViews.length;
  const conversions = (paidOrders ?? 0) + (bookingsCount ?? 0);
  const conversionRate = totalVisits > 0 ? ((conversions / totalVisits) * 100).toFixed(1) : '0.0';

  return (
    <main>
      <h1>Analytics</h1>
      <p className="muted">
        How people find and use {store.name}&apos;s site over the last 30 days. Visitors are counted anonymously — no personal data is stored.
      </p>

      <div className="metric-grid" style={{ margin: '20px 0 28px' }}>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Store visits</p>
          <p className="metric-value">{views.length}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>unique sessions</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Product/service views</p>
          <p className="metric-value">{listingViews.length}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>listing pages opened</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Shares</p>
          <p className="metric-value">{shares.length + copies.length}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>{shares.length} shared · {copies.length} links copied</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Chats started</p>
          <p className="metric-value">{chats.length}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>from your site</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Purchases & bookings</p>
          <p className="metric-value">{conversions}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>{paidOrders ?? 0} paid orders · {bookingsCount ?? 0} bookings</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Conversion rate</p>
          <p className="metric-value">{conversionRate}%</p>
          <span className="muted" style={{ fontSize: 12.5 }}>visits → purchases/bookings</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18 }}>Visits — last 14 days</h2>
        <DailyChart
          data={days.map((d) => ({ label: d.label, visits: d.visits }))}
        />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Where visitors come from</h2>
        <p className="muted" style={{ margin: '0 0 14px', fontSize: 13.5 }}>
          Grouped by how they arrived: <strong>Home page</strong> means they were browsing Naijavend itself,{' '}
          <strong>Search</strong> means a search engine, and <strong>Link</strong> means a shared link from another site.
          Views from your own device aren&apos;t counted.
        </p>
        {topReferrers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No traffic recorded yet. Share your store link and the sources will appear here.
          </p>
        ) : (
          <TopReferrers data={topReferrers.map(([label, count]) => ({ label, count }))} total={attributedViews || 1} />
        )}
      </div>
    </main>
  );
}
