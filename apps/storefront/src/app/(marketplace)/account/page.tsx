import Link from 'next/link';
import { Suspense } from 'react';
import { getCustomerSession } from '@/lib/auth';
import { supabaseAnon } from '@/lib/supabase';
import { formatNaira } from '@idevtenancy/shared';
import { SavedStores, type SavedCandidate } from '@/components/SavedStores';
import { RecentProducts } from '@/components/RecentProducts';
import { ReferralCard } from '@/components/ReferralCard';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { OrderShare } from '@/components/OrderShare';
import { OrderDispute } from './OrderDispute';
import { siteUrl } from '@/lib/site';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  paid: 'badge-blue',
  fulfilled: 'badge-success',
  cancelled: 'badge-danger',
  refunded: 'badge-blue',
};

const BUY_AGAIN_MAX = 8;
const ORDERS_SUMMARY_LIMIT = 200;
const ORDERS_LIST_LIMIT = 50;
const STORE_INDEX_LIMIT = 120;

interface OrderRow {
  id: string;
  total_kobo: number | null;
  status: string;
  created_at: string;
  discount_code: string | null;
  discount_kobo: number | null;
  stores: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
  order_items: Array<{
    listings: {
      id: string;
      title: string;
      price_kobo: number;
      compare_at_kobo: number | null;
      image_urls: string[] | null;
      type: string;
      stock: number | null;
      stores: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
    } | null;
  }> | null;
}

interface SummaryRow {
  total_kobo: number | null;
  status: string;
}

interface OrdersBundle {
  rows: OrderRow[];
  loadError: boolean;
}

export default async function MyOrdersPage() {
  // ONE auth verification per request, shared with the account layout (auth.ts
  // memoizes it), instead of layout+page+subcomponents each round-tripping.
  const session = await getCustomerSession();
  const sb = session?.client ?? null;

  if (!session || !sb) {
    return (
      <main>
        <div className="page-intro">
          <div className="container">
            <h1>My account</h1>
            <p>Sign in to see the orders you&apos;ve placed across every store.</p>
          </div>
        </div>
        <div className="container-narrow" style={{ padding: '32px 20px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/account/signin" className="btn btn-primary">Sign in</Link>
            <Link href="/account/signin" className="btn btn-outline">Create an account</Link>
          </div>
        </div>
      </main>
    );
  }

  const customer = session.user;

  // Kick off every independent read NOW, before any JSX, so they run in
  // parallel with the shell streaming to the browser. Each section below
  // awaits its own promise behind a Suspense boundary — so the orders list no
  // longer waits for the (often-empty) saved-stores index, and the referral
  // code UPSERT (a write!) is off the critical path entirely. A rejected
  // query degrades its own section only.
  const summaryP = loadSummary(sb, customer.id);
  const ordersP = loadOrders(sb, customer.id);
  const storeIndexP = loadStoreIndex();
  const referralP = loadReferral(sb, customer.id);

  return (
    <main className="account-page">
      <div className="account-page-hero">
        <div className="container">
          <h1>My account</h1>
          <p>Your orders, saved stores and favourites — in one place, at a glance.</p>
          <div className="account-hero-actions">
            <Link href="/discover" className="btn btn-primary">Discover stores</Link>
            <Link href="/account/ai" className="btn btn-outline">Ask the AI 🤖</Link>
          </div>
        </div>
      </div>

      <div className="container account-speed-dial" aria-label="Quick actions">
        <Link href="/discover" className="acct-tile">
          <span className="acct-tile-ico">🧭</span>
          <strong>Discover</strong>
          <span className="muted">Find new stores</span>
        </Link>
        <Link href="/account/bookings" className="acct-tile">
          <span className="acct-tile-ico">📅</span>
          <strong>Bookings</strong>
          <span className="muted">Your appointments</span>
        </Link>
        <Link href="/account/chats" className="acct-tile">
          <span className="acct-tile-ico">💬</span>
          <strong>Chats</strong>
          <span className="muted">Message sellers</span>
        </Link>
        <Link href="/account/alerts" className="acct-tile">
          <span className="acct-tile-ico">🔔</span>
          <strong>Alerts</strong>
          <span className="muted">Orders, drops, chats</span>
        </Link>
        <Link href="/account/profile" className="acct-tile">
          <span className="acct-tile-ico">👤</span>
          <strong>Profile</strong>
          <span className="muted">Name &amp; avatar</span>
        </Link>
      </div>

      <div className="container" style={{ padding: '24px 20px 0' }}>
        <div className="account-grid">
          <div className="account-grid-main">
            <Suspense fallback={<StatsSkeleton />}>
              <OrdersSummarySection promise={summaryP} />
            </Suspense>
            <Suspense fallback={<OrdersListSkeleton />}>
              <OrdersListSection promise={ordersP} />
            </Suspense>
            <RecentProducts />
            <Suspense fallback={<WideCardSkeleton lines={1} block={110} />}>
              <SavedStoresSection promise={storeIndexP} />
            </Suspense>
            <Suspense fallback={<WideCardSkeleton lines={1} block={104} />}>
              <ReferralSection promise={referralP} />
            </Suspense>
            <SellerUpsellCard />
          </div>

          <div className="account-grid-side">
            <AskAiCard />
            <Suspense fallback={<WideCardSkeleton lines={1} block={210} />}>
              <BuyAgainSection promise={ordersP} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============ Data loaders (each a plain promise factory, degrades on error) ============

async function loadSummary(sb: NonNullable<Awaited<ReturnType<typeof getCustomerSession>>>['client'], customerId: string): Promise<SummaryRow[]> {
  try {
    const res = await sb
      .from('orders')
      .select('total_kobo, status')
      .eq('customer_id', customerId)
      .limit(ORDERS_SUMMARY_LIMIT);
    return (res.data ?? []) as unknown as SummaryRow[];
  } catch {
    return [] as SummaryRow[];
  }
}

async function loadOrders(sb: NonNullable<Awaited<ReturnType<typeof getCustomerSession>>>['client'], customerId: string): Promise<OrdersBundle> {
  try {
    const res = await sb
      .from('orders')
      .select('id, total_kobo, status, created_at, discount_code, discount_kobo, stores(name, slug), order_items(listings(id, title, price_kobo, compare_at_kobo, image_urls, type, stock, stores(name, slug)))')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(ORDERS_LIST_LIMIT);
    return { rows: (res.data ?? []) as unknown as OrderRow[], loadError: !!res.error };
  } catch {
    return { rows: [] as OrderRow[], loadError: true };
  }
}

// Public store index for the saved-stores grid — the heaviest read on this
// page, and pointless to block orders on (many buyers have nothing saved).
async function loadStoreIndex(): Promise<SavedCandidate[]> {
  try {
    const res = await supabaseAnon()
      .from('stores')
      .select('slug, name, category, store_themes(logo_url, favicon_url)')
      .order('name')
      .limit(STORE_INDEX_LIMIT);
    return ((res.data ?? []) as unknown as Array<{
      slug: string;
      name: string;
      category: string;
      store_themes?: Array<{ logo_url: string | null; favicon_url: string | null }> | { logo_url: string | null; favicon_url: string | null };
    }>).map((r) => {
      const t = Array.isArray(r.store_themes) ? r.store_themes[0] : r.store_themes;
      return { slug: r.slug, name: r.name, category: r.category, logo: t?.logo_url ?? t?.favicon_url ?? null };
    });
  } catch {
    return [] as SavedCandidate[];
  }
}

// Referral count + code. First visit also mints the code with an upsert — a
// WRITE that used to sit serially after the orders batch, delaying the whole
// page. It now only delays this card.
async function loadReferral(
  sb: NonNullable<Awaited<ReturnType<typeof getCustomerSession>>>['client'],
  customerId: string
): Promise<{ link: string; invited: number }> {
  try {
    const [referralsRes, codeRowRes] = await Promise.all([
      sb.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer', customerId),
      sb.from('referral_codes').select('code').eq('user_id', customerId).maybeSingle(),
    ]);

    let refCode = codeRowRes.data?.code as string | undefined;
    if (!refCode) {
      refCode = Array.from({ length: 8 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
      await sb.from('referral_codes').upsert({ user_id: customerId, code: refCode });
    }
    return { link: `${siteUrl()}/account/signin?ref=${refCode}`, invited: referralsRes.count ?? 0 };
  } catch {
    const refCode = Array.from({ length: 8 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    return { link: `${siteUrl()}/account/signin?ref=${refCode}`, invited: 0 };
  }
}

// ============ Streamed sections (async server components) ============

async function OrdersSummarySection({ promise }: { promise: Promise<SummaryRow[]> }) {
  const rows = await promise;
  return <OrdersSummary rows={rows} />;
}

async function OrdersListSection({ promise }: { promise: Promise<OrdersBundle> }) {
  const { rows, loadError } = await promise;
  return <OrdersList orders={rows} loadError={loadError} />;
}

async function BuyAgainSection({ promise }: { promise: Promise<OrdersBundle> }) {
  const { rows } = await promise;
  return <BuyAgainCard buyAgain={collectBuyAgain(rows, BUY_AGAIN_MAX)} />;
}

async function SavedStoresSection({ promise }: { promise: Promise<SavedCandidate[]> }) {
  const stores = await promise;
  return <SavedStores stores={stores} />;
}

async function ReferralSection({ promise }: { promise: Promise<{ link: string; invited: number }> }) {
  const { link, invited } = await promise;
  return <ReferralCard link={link} invited={invited} />;
}

// ============ Skeletons (shaped like the real sections) ============

function StatsSkeleton() {
  return (
    <div className="skel-grid skel-grid-4" aria-busy="true" aria-label="Loading order summary">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skel skel-stat" />
      ))}
    </div>
  );
}

function OrdersListSkeleton() {
  return (
    <section className="card card-elevated" style={{ padding: 18 }} aria-busy="true" aria-label="Loading your orders">
      <div className="skel skel-line w-25" style={{ height: 20 }} />
      <div className="account-skel-stack" style={{ marginTop: 14 }}>
        <div className="skel skel-order" />
        <div className="skel skel-order" />
      </div>
    </section>
  );
}

function WideCardSkeleton({ lines, block }: { lines: number; block: number }) {
  return (
    <section className="card card-elevated" style={{ padding: 18 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skel skel-line w-30" style={{ height: 18 }} />
      ))}
      <div className="skel" style={{ height: block, marginTop: 12 }} />
    </section>
  );
}

// ============ Static sections (no data needed) ============

function SellerUpsellCard() {
  return (
    <section className="card card-elevated seller-upsell" aria-label="Sell on Naijavend">
      <div className="seller-upsell-head">
        <div>
          <h2>💼 Turn shopping into selling</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            Every order you make here comes from a seller just like you. Open your own store in
            minutes — and let our AI design and style it for you.
          </p>
        </div>
      </div>
      <div className="seller-upsell-actions">
        <Link href="/dashboard" className="btn btn-primary">
          Start selling
        </Link>
        <Link href="/dashboard/ai" className="btn btn-outline">
          🎨 Let AI design my store
        </Link>
      </div>
    </section>
  );
}

function BuyAgainCard({ buyAgain }: { buyAgain: ProductCardItem[] }) {
  if (buyAgain.length === 0) return null;

  return (
    <section className="card card-elevated buy-again-card" aria-label="Buy again">
      <div className="buy-again-head">
        <h2>🔁 Buy again</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Items you bought before, most recent first
        </span>
      </div>
      <div className="product-row account-buy-again-row" style={{ marginTop: 14 }}>
        {buyAgain.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function AskAiCard() {
  const starters = [
    { label: 'Track my last order', q: 'Where is my last order?' },
    { label: 'Recommend something', q: 'Recommend products I might like' },
  ];
  return (
    <section className="card card-elevated ask-ai-card" aria-label="Ask Naijavend">
      <div className="ask-ai-head">
        <div className="ask-ai-icon">🤖</div>
        <div className="ask-ai-title">
          <h2>Ask Naijavend</h2>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Shopping assistant — stores, orders, picks.
          </p>
        </div>
        <Link href="/account/ai" className="btn btn-primary btn-sm">
          Open
        </Link>
      </div>
      <div className="ask-ai-starters">
        {starters.map((s) => (
          <Link key={s.q} href={`/account/ai?q=${encodeURIComponent(s.q)}`} className="ai-chip">
            {s.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

// Sync: stats come from the page's single parallel query batch — no extra
// auth round trip, no extra orders query inside the render tree.
function OrdersSummary({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) return null;
  const spent = rows
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total_kobo ?? 0), 0);
  const active = rows.filter((o) => o.status === 'pending' || o.status === 'paid').length;
  const delivered = rows.filter((o) => o.status === 'fulfilled').length;

  const stats = [
    { label: 'Orders placed', value: Number(rows.length), ico: '🧾' },
    { label: 'Total spent', value: formatNaira(spent), ico: '💳' },
    { label: 'In progress', value: Number(active), ico: '⏳' },
    { label: 'Delivered', value: Number(delivered), ico: '✅' },
  ];
  return (
    <div className="account-stats" aria-label="Order summary">
      {stats.map((s) => (
        <div key={s.label} className="account-stat">
          <span className="account-stat-ico" aria-hidden>{s.ico}</span>
          <strong className="account-stat-value">{s.value}</strong>
          <span className="muted account-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// Sync: renders the already-fetched order rows (previously re-ran the same
// query with its own auth round trip).
function OrdersList({ orders, loadError }: { orders: OrderRow[]; loadError: boolean }) {
  if (loadError) {
    return <div className="alert alert-error">Could not load your orders. Try again shortly.</div>;
  }

  if (orders.length === 0) {
    return (
      <section className="card card-elevated" aria-label="Your orders">
        <div className="section-head"><h2>🧾 Your orders</h2></div>
        <div className="empty-state">
          <h3>No orders yet</h3>
          <p>Browse stores to see your first order here.</p>
          <div style={{ marginTop: 10 }}>
            <Link href="/discover" className="btn btn-outline btn-sm">Browse stores →</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-elevated" aria-label="Your orders">
      <div className="section-head"><h2>🧾 Your orders</h2></div>
      <div className="orders-list">
        {orders.map((o) => {
          const store = Array.isArray(o.stores) ? o.stores[0] : o.stores;
          const items = o.order_items ?? [];
          const titles = items.map((it) => it.listings?.title).filter(Boolean) as string[];
          const count = titles.length;
          const summary = count > 0 ? (count <= 2 ? titles.join(' · ') : `${titles[0]} + ${count - 1} more`) : null;
          const steps = ['pending', 'paid', 'fulfilled'] as const;
          const stepIndex = steps.indexOf(o.status as (typeof steps)[number]);
          const cancelled = o.status === 'cancelled' || o.status === 'refunded';
          return (
            <div key={o.id} className="card order-card">
              <div className="order-card-head">
                <div className="order-card-tags">
                  <span className={`badge ${STATUS_BADGE[o.status] ?? ''}`}>{o.status}</span>
                  {store && <OrderShare storeName={store.name} storeSlug={store.slug} orderId={String(o.id)} total={formatNaira(o.total_kobo as number)} status={String(o.status)} />}
                </div>
                {summary && <span className="muted" style={{ fontSize: 13 }}>{summary}</span>}
              </div>
              {store && (
                <div className="order-card-meta">
                  <Link href={`/s/${store.slug}`} className="order-card-store">🏪 {store.name}</Link>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {new Date(o.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {count > 0 && ` · ${count} item${count === 1 ? '' : 's'}`}
                  </span>
                </div>
              )}
              {!cancelled && (
                <div className="order-steps" aria-label="Order progress">
                  {steps.map((s, i) => (
                    <div
                      key={s}
                      className={`order-step ${stepIndex >= i ? 'is-done' : ''} ${stepIndex === i ? 'is-current' : ''}`}
                      title={s}
                    />
                  ))}
                </div>
              )}
              {(o.discount_kobo ?? 0) > 0 && (
                <span className="order-card-discount">
                  🎟️ {o.discount_code} — saved {formatNaira(o.discount_kobo as number)}
                </span>
              )}
              <OrderDispute orderId={String(o.id)} orderStatus={String(o.status)} />
              <div className="order-card-footer">
                <span className="price">{formatNaira(o.total_kobo as number)}</span>
                <span className="mono muted" style={{ fontSize: 12 }}>#{String(o.id).slice(0, 8)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function collectBuyAgain(orderRows: OrderRow[], max: number): ProductCardItem[] {
  const seen = new Set<string>();
  const out: ProductCardItem[] = [];
  for (const row of orderRows) {
    for (const it of row.order_items ?? []) {
      const l = it?.listings ?? null;
      if (!l || seen.has(l.id)) continue;
      seen.add(l.id);
      const storeObj = Array.isArray(l.stores) ? l.stores[0] : l.stores;
      out.push({
        id: l.id,
        title: l.title,
        priceKobo: l.price_kobo,
        type: l.type,
        imageUrl: l.image_urls?.[0] ?? null,
        storeName: storeObj?.name ?? '',
        storeSlug: storeObj?.slug ?? '',
        compareAtKobo: l.compare_at_kobo,
        stock: l.stock,
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}
