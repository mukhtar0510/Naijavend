import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { BookingActions } from './BookingActions';
import type { Booking, Listing } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) {
    return <main><h1>Bookings</h1><p className="muted">Create your store first.</p></main>;
  }

  const { data: listings } = await sb.from('listings').select('id').eq('store_id', store.id);
  const listingIds = (listings as Pick<Listing, 'id'>[] | null)?.map((l) => l.id) ?? [];

  let bookings: Booking[] = [];
  if (listingIds.length > 0) {
    const { data } = await sb
      .from('bookings')
      .select('*, listings(title)')
      .in('listing_id', listingIds)
      .order('slot_start', { ascending: true })
      .limit(100);
    bookings = (data as unknown as (Booking & { listings: { title: string } | null })[] | null)?.map((b) => ({ ...b, listing_title: b.listings?.title })) as never ?? [];
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <main>
      <h1>Bookings</h1>
      <p className="muted">Appointment requests from your store page. Confirm to lock the slot.</p>
      {bookings.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {bookings.map((b) => (
            <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span className={`badge ${b.status === 'pending' ? 'badge-black' : b.status === 'confirmed' ? 'badge-blue' : b.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                  {b.status}
                </span>{' '}
                <strong>{b.customer_name}</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  {(b as unknown as { listing_title?: string }).listing_title} · {fmt(b.slot_start)}
                </p>
              </div>
              <BookingActions bookingId={b.id} status={b.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No bookings yet. Service listings show a booking button on your store page.</div>
      )}
    </main>
  );
}
