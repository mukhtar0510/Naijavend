import Link from 'next/link';
import { getCustomerClient, getCustomerUser } from '@/lib/auth';
import { supabaseAnon } from '@/lib/supabase';
import { formatNaira } from '@idevtenancy/shared';
import { SavedStores, type SavedCandidate } from '@/components/SavedStores';
import { RecentProducts } from '@/components/RecentProducts';
import { ReferralCard } from '@/components/ReferralCard';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { OrderShare } from '@/components/OrderShare';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  paid: 'badge-blue',
  fulfilled: 'badge-success',
  cancelled: 'badge-danger',
};

export default async function MyOrdersPage() {
  const customer = await getCustomerUser();
  const sb = await getCustomerClient();

  if (!customer) {
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

  // customer identity and sb refresh independently — if the token died between
  // the two calls sb can be null here; send to sign-in instead of crashing.
  if (!sb) {
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

  // Index of stores for the saved-stores section (hearts live in the browser;
  // this list is what saved slugs resolve against).
  const { data: storeIndex } = await supabaseAnon()
    .from('stores')
    .select('slug, name, category, store_themes(logo_url, favicon_url)')
    .order('name')
    .limit(200);
  const savedCandidates: SavedCandidate[] = (storeIndex ?? []).map((row) => {
    const r = row as unknown as {
      slug: string;
      name: string;
      category: string;
      store_themes?: Array<{ logo_url: string | null; favicon_url: string | null }> | { logo_url: string | null; favicon_url: string | null };
    };
    const t = Array.isArray(r.store_themes) ? r.store_themes[0] : r.store_themes;
    return { slug: r.slug, name: r.name, category: r.category, logo: t?.logo_url ?? t?.favicon_url ?? null };
  });

  // Buy again: distinct listings from this customer's past orders, newest first.
  const { data: orderRows } = await sb
    .from('orders')
    .select('order_items(listings(id, title, price_kobo, compare_at_kobo, image_urls, type, stock, stores(name, slug)))')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(25);
  const seen = new Set<string>();
  const buyAgain: ProductCardItem[] = [];
  for (const row of orderRows ?? []) {
    const items = (row as { order_items?: Array<{ listings?: unknown }> }).order_items ?? [];
    for (const it of items) {
      const l = it?.listings as
        | {
            id: string;
            title: string;
            price_kobo: number;
            compare_at_kobo: number | null;
            image_urls: string[] | null;
            type: string;
            stock: number | null;
            stores: { name: string; slug: string } | { name: string; slug: string }[] | null;
          }
        | null;
      if (!l || seen.has(l.id)) continue;
      seen.add(l.id);
      const storeObj = Array.isArray(l.stores) ? l.stores[0] : l.stores;
      buyAgain.push({
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
      if (buyAgain.length >= 8) break;
    }
    if (buyAgain.length >= 8) break;
  }

  // Referral code (created on first visit) + how many friends joined through it.
  const { data: codeRow } = await sb.from('referral_codes').select('code').eq('user_id', customer.id).maybeSingle();
  let refCode = codeRow?.code as string | undefined;
  if (!refCode) {
    refCode = Array.from({ length: 8 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    await sb.from('referral_codes').upsert({ user_id: customer.id, code: refCode });
  }
  const { count: invited } = await sb.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer', customer.id);

  return (
    <main>
      <div className="page-intro">
        <div className="container">
          <h1>My account</h1>
          <p>Your orders across every Naijavend store, in one place.</p>
        </div>
      </div>
      <div className="container" style={{ padding: '24px 20px' }}>
        <ReferralCard link={`${siteUrl()}/account/signin?ref=${refCode}`} invited={invited ?? 0} />
        <SavedStores stores={savedCandidates} />
        {buyAgain.length > 0 && (
          <section className="history-row" aria-label="Buy again">
            <h2>🔁 Buy again</h2>
            <div className="product-row" style={{ marginTop: 14 }}>
              {buyAgain.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
        <RecentProducts />
        <OrdersList customerId={customer.id} />
      </div>
    </main>
  );
}

// Server-side read of the customer's own orders with the customer's own JWT —
// the orders_customer_read RLS policy scopes rows to auth.uid() = customer_id.
async function OrdersList({ customerId }: { customerId: string }) {
  const { getCustomerClient } = await import('@/lib/auth');
  const sb = await getCustomerClient();
  if (!sb) {
    return <div className="alert alert-error">Your session expired. Refresh the page to sign in again.</div>;
  }
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, total_kobo, status, created_at, discount_code, discount_kobo, stores(name, slug), order_items(listings(title, type))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[account] orders load failed:', error);
    return <div className="alert alert-error">Could not load your orders. Try again shortly.</div>;
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="empty-state">
        No orders yet. <Link href="/discover">Browse stores →</Link>
      </div>
    );
  }

  return (
    <div className="listing-grid">
      {orders.map((o) => {
        const store = o.stores as unknown as { name: string; slug: string } | null;
        const items = (o.order_items as unknown as Array<{ listings?: { title: string; type: string } | null }> | null) ?? [];
        const titles = items.map((it) => it.listings?.title).filter(Boolean) as string[];
        const summary = titles.length > 0 ? (titles.length <= 2 ? titles.join(' · ') : `${titles[0]} + ${titles.length - 1} more`) : null;
        // Buyer-visible progress: the three states that matter to a shopper.
        const steps = ['pending', 'paid', 'fulfilled'] as const;
        const stepIndex = steps.indexOf(o.status as (typeof steps)[number]);
        const cancelled = o.status === 'cancelled';
        return (
          <div key={o.id} className="card listing-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${STATUS_BADGE[o.status] ?? ''}`}>{o.status}</span>
              {store && (
                <OrderShare
                  storeName={store.name}
                  storeSlug={store.slug}
                  orderId={String(o.id)}
                  total={formatNaira(o.total_kobo as number)}
                  status={String(o.status)}
                />
              )}
            </div>
            {store && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Link href={`/s/${store.slug}`} style={{ fontWeight: 600 }}>{store.name}</Link>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Link href={`/s/${store.slug}/chat`} className="order-share" title={`Message ${store.name}`}>
                    💬 Message
                  </Link>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {new Date(o.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
              </div>
            )}
            {summary && <span className="muted" style={{ fontSize: 13 }}>{summary}</span>}
            {(o.discount_kobo as number) > 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 600 }}>
                🎟️ {o.discount_code} — saved {formatNaira(o.discount_kobo as number)}
              </span>
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
            <span className="price">{formatNaira(o.total_kobo as number)}</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{String(o.id).slice(0, 8)}</span>
          </div>
        );
      })}
    </div>
  );
}
