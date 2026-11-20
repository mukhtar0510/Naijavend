import Link from 'next/link';

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
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Compass,
  MessageSquare,
  Package,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Bot as IcBot, Briefcase as IcBriefcase, CircleCheck as IcCircleCheck, CreditCard as IcCreditCard, Hourglass as IcHourglass, Package as IcPackage, Palette as IcPalette, Receipt as IcReceipt, Repeat as IcRepeat, ShoppingBag as IcShoppingBag, Store as IcStore, Ticket as IcTicket } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  paid: 'badge-naija',
  fulfilled: 'badge-naija',
  cancelled: 'badge-danger',
  refunded: 'badge-gold',
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
      <main className="nv-acc">
        <section className="nv-acc-hero">
          <div className="nv-acc-hero-copy">
            <span className="nv-pill nv-pill-invert">My account</span>
            <h1>Your orders and bookings, in one place.</h1>
            <p>
              Sign in once to track every order across every store, manage appointments, message
              sellers and keep your saved stores on every device.
            </p>
            <div className="nv-acc-hero-actions">
              <Link href="/account/signin" className="btn btn-white btn-lg">
                Sign in <ArrowRight size={16} />
              </Link>
              <Link href="/account/signin?mode=create" className="btn btn-ghost-light btn-lg">
                Create a free account
              </Link>
            </div>
          </div>
          <ul className="nv-acc-hero-points">
            <li>
              <Package size={16} aria-hidden /> Track orders from checkout to delivery
            </li>
            <li>
              <CalendarDays size={16} aria-hidden /> Reschedule or cancel bookings yourself
            </li>
            <li>
              <MessageSquare size={16} aria-hidden /> Chat with any seller you&apos;ve bought from
            </li>
          </ul>
        </section>
        <div className="nv-acc-empty">
          <h2>Nothing to show yet</h2>
          <p>Your orders will appear here the moment you sign in.</p>
          <Link href="/discover" className="btn btn-outline btn-sm">
            Browse stores <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    );
  }

  const customer = session.user;

  // Kick off every independent read NOW, before any JSX, so they run in
  // parallel. The sections are resolved here rather than as async JSX children:
  // a `Promise<Element>` is not a JSX element type under the React 18 typings
  // the deploy build uses. A rejected query still degrades its own section only.
  const summaryP = loadSummary(sb, customer.id);
  const ordersP = loadOrders(sb, customer.id);
  const storeIndexP = loadStoreIndex();
  const referralP = loadReferral(sb, customer.id);

  return (
    <main className="nv-acc">
      <section className="nv-acc-hero nv-acc-hero-compact">
        <div className="nv-acc-hero-copy">
          <span className="nv-pill nv-pill-invert">My account</span>
          <h1>Welcome back — here&apos;s your marketplace at a glance.</h1>
          <p>Orders, bookings, chats and saved stores, all in one place.</p>
          <div className="nv-acc-hero-actions">
            <Link href="/discover" className="btn btn-white btn-sm">
              <Compass size={15} /> Discover stores
            </Link>
            <Link href="/account/ai" className="btn btn-ghost-light btn-sm">
              <Sparkles size={15} /> Ask the AI
            </Link>
          </div>
        </div>
      </section>

      <nav className="nv-acc-tiles" aria-label="Quick actions">
        <Link href="/discover" className="nv-acc-tile">
          <span className="nv-acc-tile-ico"><Compass size={18} /></span>
          <strong>Discover</strong>
          <span>Find new stores</span>
        </Link>
        <Link href="/account/bookings" className="nv-acc-tile">
          <span className="nv-acc-tile-ico"><CalendarDays size={18} /></span>
          <strong>Bookings</strong>
          <span>Your appointments</span>
        </Link>
        <Link href="/account/chats" className="nv-acc-tile">
          <span className="nv-acc-tile-ico"><MessageSquare size={18} /></span>
          <strong>Chats</strong>
          <span>Message sellers</span>
        </Link>
        <Link href="/account/alerts" className="nv-acc-tile">
          <span className="nv-acc-tile-ico"><Bell size={18} /></span>
          <strong>Alerts</strong>
          <span>Orders, drops, chats</span>
        </Link>
        <Link href="/account/profile" className="nv-acc-tile">
          <span className="nv-acc-tile-ico"><UserRound size={18} /></span>
          <strong>Profile</strong>
          <span>Name &amp; avatar</span>
        </Link>
      </nav>

      <div className="nv-acc-content">
        <div className="nv-acc-grid">
          <div className="nv-acc-main">
            {await OrdersSummarySection({ promise: summaryP })}
            {await OrdersListSection({ promise: ordersP })}
            <RecentProducts />
            {await SavedStoresSection({ promise: storeIndexP })}
            {await ReferralSection({ promise: referralP })}
            <SellerUpsellCard />
          </div>

          <aside className="nv-acc-side">
            <AskAiCard />
            {await BuyAgainSection({ promise: ordersP })}
          </aside>
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

// ============ Static sections (no data needed) ============

function SellerUpsellCard() {
  return (
    <section className="nv-acc-card nv-acc-selling" aria-label="Sell on Kwaravend">
      <div className="seller-upsell-head">
        <div>
          <h2><IcBriefcase className="ico-inline" aria-hidden /> Turn shopping into selling</h2>
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
          <IcPalette className="ico-inline" aria-hidden /> Let AI design my store
        </Link>
      </div>
    </section>
  );
}

function BuyAgainCard({ buyAgain }: { buyAgain: ProductCardItem[] }) {
  if (buyAgain.length === 0) return null;

  return (
    <section className="nv-acc-card" aria-label="Buy again">
      <div className="nv-acc-card-head">
        <h2><IcRepeat className="ico-inline" aria-hidden /> Buy again</h2>
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
    <section className="nv-acc-card nv-acc-ai" aria-label="Ask Kwaravend">
      <div className="nv-acc-ai-head">
        <div className="ask-ai-icon"><IcBot className="ico-inline" aria-hidden /></div>
        <div className="ask-ai-title">
          <h2>Ask Kwaravend</h2>
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
    { label: 'Orders placed', value: Number(rows.length), ico: <IcReceipt className="ico-inline" aria-hidden /> },
    { label: 'Total spent', value: formatNaira(spent), ico: <IcCreditCard className="ico-inline" aria-hidden /> },
    { label: 'In progress', value: Number(active), ico: <IcHourglass className="ico-inline" aria-hidden /> },
    { label: 'Delivered', value: Number(delivered), ico: <IcCircleCheck className="ico-inline" aria-hidden /> },
  ];
  return (
    <div className="nv-acc-stats" aria-label="Order summary">
      {stats.map((s) => (
        <div key={s.label} className="nv-acc-stat">
          <span className="nv-acc-stat-ico" aria-hidden>{s.ico}</span>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
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
      <section className="nv-acc-card" aria-label="Your orders">
        <header className="nv-acc-card-head">
          <h2>
            <Package size={17} aria-hidden /> Your orders
          </h2>
        </header>
        <div className="nv-acc-blank">
          <span aria-hidden><IcReceipt className="ico-inline" aria-hidden /></span>
          <h3>No orders yet</h3>
          <p>Browse stores to see your first order here.</p>
          <Link href="/discover" className="btn btn-outline btn-sm">
            Browse stores <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="nv-acc-card" aria-label="Your orders">
      <header className="nv-acc-card-head">
        <h2>
          <Package size={17} aria-hidden /> Your orders
        </h2>
        <span className="nv-acc-card-count">{orders.length}</span>
      </header>
      <div className="nv-acc-orders">
        {orders.map((o) => {
          const store = Array.isArray(o.stores) ? o.stores[0] : o.stores;
          const items = o.order_items ?? [];
          const titles = items.map((it) => it.listings?.title).filter(Boolean) as string[];
          const thumbs = items
            .map((it) => it.listings?.image_urls?.[0])
            .filter(Boolean)
            .slice(0, 3) as string[];
          const count = titles.length;
          const summary = count > 0 ? (count <= 2 ? titles.join(' · ') : `${titles[0]} + ${count - 1} more`) : null;
          const steps = ['pending', 'paid', 'fulfilled'] as const;
          const stepIndex = steps.indexOf(o.status as (typeof steps)[number]);
          const cancelled = o.status === 'cancelled' || o.status === 'refunded';
          return (
            <article key={o.id} className="nv-acc-order">
              <div className="nv-acc-order-top">
                <div className="nv-acc-order-media">
                  {thumbs.length > 0 ? (
                    thumbs.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                      <img key={i} src={src} alt="" loading="lazy" />
                    ))
                  ) : (
                    <span className="nv-acc-order-ph" aria-hidden>
                      {o.status === 'fulfilled' ? <IcPackage className="ico-inline" aria-hidden /> : <IcShoppingBag className="ico-inline" aria-hidden />}
                    </span>
                  )}
                </div>

                <div className="nv-acc-order-info">
                  <div className="nv-acc-order-tags">
                    <span className={`badge ${STATUS_BADGE[o.status] ?? ''}`}>{o.status}</span>
                    <span className="nv-acc-order-id">#{String(o.id).slice(0, 8)}</span>
                  </div>
                  <strong className="nv-acc-order-title">{summary ?? 'Order'}</strong>
                  <div className="nv-acc-order-meta">
                    {store && (
                      <Link href={`/s/${store.slug}`} className="nv-acc-order-store">
                        <IcStore className="ico-inline" aria-hidden /> {store.name}
                      </Link>
                    )}
                    <span>
                      {new Date(o.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {count > 0 && ` · ${count} item${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  {!cancelled && (
                    <div className="nv-acc-steps" aria-label="Order progress">
                      {steps.map((s, i) => (
                        <span
                          key={s}
                          className={`nv-acc-step ${stepIndex >= i ? 'is-done' : ''} ${stepIndex === i ? 'is-current' : ''}`}
                          title={s}
                        />
                      ))}
                      <em>{cancelled ? 'Cancelled' : steps[Math.max(0, stepIndex)]}</em>
                    </div>
                  )}
                  {(o.discount_kobo ?? 0) > 0 && (
                    <span className="nv-acc-order-discount">
                      <IcTicket className="ico-inline" aria-hidden /> {o.discount_code} — saved {formatNaira(o.discount_kobo as number)}
                    </span>
                  )}
                </div>

                <div className="nv-acc-order-side">
                  <strong className="nv-acc-order-total">{formatNaira(o.total_kobo as number)}</strong>
                  {store && <OrderShare storeName={store.name} storeSlug={store.slug} orderId={String(o.id)} total={formatNaira(o.total_kobo as number)} status={String(o.status)} />}
                  <OrderDispute orderId={String(o.id)} orderStatus={String(o.status)} />
                </div>
              </div>
            </article>
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
