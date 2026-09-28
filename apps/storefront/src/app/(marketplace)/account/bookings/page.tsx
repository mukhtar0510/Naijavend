import Link from 'next/link';
import { getCustomerUser } from '@/lib/auth';
import { getCustomerClient } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My bookings' };

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  confirmed: 'badge-blue',
  completed: 'badge-success',
  cancelled: 'badge-danger',
};

export default async function MyBookingsPage() {
  const customer = await getCustomerUser();

  if (!customer) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <h1>My bookings</h1>
        <p className="muted">Sign in to see the appointments you&apos;ve booked across every store.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account/signin" className="btn btn-primary">Sign in</Link>
          <Link href="/discover" className="btn btn-outline">Browse stores</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ padding: '24px 20px' }}>
      <h1>My bookings</h1>
      <BookingsList customerId={customer.id} />
    </main>
  );
}

// Server-side read of the customer's own bookings with the customer's own JWT —
// the bookings_customer_read RLS policy scopes rows to auth.uid() = customer_id.
// (Legacy bookings without customer_id are invisible here; new bookings stamp it.)
async function BookingsList({ customerId }: { customerId: string }) {
  const sb = await getCustomerClient();
  if (!sb) {
    return <div className="alert alert-error">Your session expired. Refresh the page to sign in again.</div>;
  }
  const { data: bookings, error } = await sb
    .from('bookings')
    .select('id, customer_name, customer_phone, slot_start, slot_end, status, deposit_paid_kobo, created_at, listings(title, stores(name, slug))')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[account] bookings load failed:', error);
    return <div className="alert alert-error">Could not load your bookings. Try again shortly.</div>;
  }

  const mine = bookings ?? [];

  if (mine.length === 0) {
    return (
      <div className="empty-state">
        No bookings yet. <Link href="/discover">Find a service to book →</Link>
      </div>
    );
  }

  return (
    <div className="listing-grid">
      {mine.map((b) => {
        const listing = b.listings as unknown as { title: string; stores: { name: string; slug: string } | null } | null;
        const store = listing?.stores ?? null;
        const start = new Date(b.slot_start as string);
        const end = new Date(b.slot_end as string);
        return (
          <div key={String(b.id)} className="card listing-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${STATUS_BADGE[b.status as string] ?? ''}`}>{b.status}</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {start.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <span style={{ fontWeight: 600 }}>{listing?.title ?? 'Appointment'}</span>
            {store && <Link href={`/s/${store.slug}`}>{store.name}</Link>}
            <span className="muted" style={{ fontSize: 14 }}>
              {start.toLocaleString('en-NG', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
              {' — '}
              {end.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {Number(b.deposit_paid_kobo) > 0 && (
              <span className="badge badge-success">Deposit paid</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
