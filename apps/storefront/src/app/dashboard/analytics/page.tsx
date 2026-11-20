import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { siteUrl } from '@/lib/site';
import { DailyChart, TopReferrers } from './Charts';
import { InsightCard } from './InsightCard';
import { classifyTrafficSource, ownHostsFromSiteUrl } from '@idevtenancy/shared';
import type { Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DailyEventRow {
  day: string;
  event_type: string;
  event_count: number;
}

interface ReferrerRow {
  referrer: string | null;
  source: string | null;
  event_count: number;
}

export default async function AnalyticsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  await redirectStaffToPos(sb); // R4: analytics are owner-only
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

  const since = new Date(Date.now() - 29 * DAY_MS).toISOString().slice(0, 10);

  // Counting happens in Postgres (see migration 20261114000000): the page reads
  // a few dozen aggregate rows instead of up to 5,000 raw events.
  const [eventsRes, referrersRes, salesRes, listingIdsRes] = await Promise.all([
    sb
      .from('store_events_daily')
      .select('day, event_type, event_count')
      .eq('store_id', store.id)
      .gte('day', since),
    sb
      .from('store_referrer_daily')
      .select('referrer, source, event_count')
      .eq('store_id', store.id)
      .gte('day', since),
    sb
      .from('store_sales_daily')
      .select('order_count, revenue_kobo')
      .eq('store_id', store.id)
      .gte('day', since),
    sb.from('listings').select('id').eq('store_id', store.id),
  ]);

  const rows = (eventsRes.data ?? []) as DailyEventRow[];
  const countOf = (type: string) =>
    rows.filter((r) => r.event_type === type).reduce((sum, r) => sum + Number(r.event_count ?? 0), 0);

  const views = countOf('view');
  const listingViews = countOf('listing_view');
  const shares = countOf('share');
  const copies = countOf('link_copy');
  const chats = countOf('chat_started');
  const paidOrders = (salesRes.data ?? []).reduce((sum, r) => sum + Number(r.order_count ?? 0), 0);

  const listingIds = (listingIdsRes.data ?? []).map((l) => l.id as string);
  const { count: bookingsCount } = listingIds.length
    ? await sb
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('listing_id', listingIds)
        .in('status', ['confirmed', 'completed'])
    : { count: 0 };

  // 14-day daily series (views + listing views), built from the daily view.
  const perDay = new Map<string, number>();
  for (const r of rows) {
    if (r.event_type !== 'view' && r.event_type !== 'listing_view') continue;
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + Number(r.event_count ?? 0));
  }
  const days: Array<{ label: string; iso: string; visits: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const iso = day.toISOString().slice(0, 10);
    days.push({
      label: day.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
      iso,
      visits: perDay.get(iso) ?? 0,
    });
  }

  // Where visitors came from, folded into seller-readable groups (Home page,
  // Search, Link, named social apps). Raw hosts and the seller's own dev
  // traffic never reach this list — see classifyTrafficSource.
  const ownHosts = ownHostsFromSiteUrl(siteUrl());
  const refCounts = new Map<string, number>();
  let attributedViews = 0;
  for (const r of (referrersRes.data ?? []) as ReferrerRow[]) {
    const src = classifyTrafficSource(r.referrer, r.source, ownHosts);
    if (src.ignore) continue;
    const count = Number(r.event_count ?? 0);
    refCounts.set(src.label, (refCounts.get(src.label) ?? 0) + count);
    attributedViews += count;
  }
  const topReferrers = [...refCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalVisits = views + listingViews;
  const conversions = paidOrders + (bookingsCount ?? 0);
  const conversionRate = totalVisits > 0 ? ((conversions / totalVisits) * 100).toFixed(1) : '0.0';

  return (
    <main>
      <h1>Analytics</h1>
      <p className="muted">
        How people find and use {store.name}&apos;s site over the last 30 days. Visitors are counted anonymously — no personal data is stored.
      </p>

      {/* Plain-language weekly summary — fetched in the background so these
          charts paint first. See /api/ai/insights. */}
      <InsightCard />

      <div className="metric-grid" style={{ margin: '20px 0 28px' }}>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Store visits</p>
          <p className="metric-value">{views}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>unique sessions</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Product/service views</p>
          <p className="metric-value">{listingViews}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>listing pages opened</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Shares</p>
          <p className="metric-value">{shares + copies}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>{shares} shared · {copies} links copied</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Chats started</p>
          <p className="metric-value">{chats}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>from your site</span>
        </div>
        <div className="metric-card">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Purchases &amp; bookings</p>
          <p className="metric-value">{conversions}</p>
          <span className="muted" style={{ fontSize: 12.5 }}>{paidOrders} paid orders · {bookingsCount ?? 0} bookings</span>
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
          Grouped by how they arrived: <strong>Home page</strong> means they were browsing Kwaravend itself,{' '}
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
