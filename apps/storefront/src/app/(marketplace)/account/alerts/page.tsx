import Link from 'next/link';
import type { Metadata } from 'next';
import { getCustomerClient, getCustomerUser } from '@/lib/auth';
import { AlertsInbox } from './AlertsInbox';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Alerts — Naijavend' };

interface AlertRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<string, string> = {
  new_product: '🛍️',
  price_drop: '⬇️',
  order_update: '🧾',
  booking_update: '📅',
  chat: '💬',
  dispute_update: '⚖️',
};

// Buyer alerts inbox — new products from followed stores, price drops, order/
// booking status flips, seller chat replies and dispute outcomes. RLS scopes
// the read to auth.uid(); rows are fanned out by DB triggers + service routes.
export default async function AlertsPage() {
  const customer = await getCustomerUser();

  if (!customer) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <h1>Alerts</h1>
        <p className="muted">Sign in to get alerts for new products, price drops, orders and chats.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Link href="/account/signin?next=/account/alerts" className="btn btn-primary">Sign in</Link>
          <Link href="/discover" className="btn btn-outline">Browse stores</Link>
        </div>
      </main>
    );
  }

  const sb = await getCustomerClient();
  if (!sb) {
    return <div className="alert alert-error">Your session expired. Refresh the page to sign in again.</div>;
  }

  const { data, error } = await sb
    .from('alerts')
    .select('id, kind, title, body, href, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[alerts] load failed:', error);
    return <div className="alert alert-error">Could not load your alerts. Try again shortly.</div>;
  }

  const rows = (data ?? []) as AlertRow[];
  const unread = rows.filter((r) => !r.read_at).length;

  const initial = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    read: Boolean(r.read_at),
    createdAt: r.created_at,
    icon: KIND_ICON[r.kind] ?? '🔔',
  }));

  return (
    <main className="container-narrow" style={{ padding: '36px 20px 60px', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1>Alerts</h1>
        <span className="muted" style={{ fontSize: 13.5 }}>
          {unread > 0 ? `${unread} unread` : 'All caught up ✅'}
        </span>
      </div>
      <p className="muted" style={{ marginTop: -4, marginBottom: 16 }}>
        Follow stores on their page to get new-product and price-drop alerts here — plus order,
        booking, chat and report updates.
      </p>
      <AlertsInbox initial={initial} />
    </main>
  );
}
