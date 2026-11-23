import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { OrderForm, type OrderListing } from './OrderForm';

// Server shell for the direct "Order" / "Buy & get download" page: loads the
// listing so the buyer sees what they are buying and its price, and so a
// download skips delivery. The database still prices the order itself.
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: { slug: string; listingId: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.listingId)) notFound();

  const { data } = await supabaseAnon()
    .from('listings')
    .select('id, title, price_kobo, type, digital_file_path, digital_file_name, stores!inner(slug)')
    .eq('id', params.listingId)
    .eq('stores.slug', params.slug)
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as {
    id: string;
    title: string;
    price_kobo: number;
    type: string;
    digital_file_path: string | null;
    digital_file_name: string | null;
  };

  // Services are booked, not ordered.
  if (row.type === 'service') {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <h1>{row.title}</h1>
        <p className="muted">This is a service. Book a time with the seller instead.</p>
        <Link className="btn btn-primary" href={`/s/${params.slug}/book/${row.id}`}>
          Book appointment
        </Link>
      </main>
    );
  }
  // A download with no file yet cannot be delivered.
  if (row.type === 'digital' && !row.digital_file_path) {
    return (
      <main className="container-narrow" style={{ padding: '48px 20px' }}>
        <h1>{row.title}</h1>
        <p className="muted">The seller has not uploaded this file yet, so it cannot be bought right now.</p>
        <Link className="btn btn-outline" href={`/s/${params.slug}`}>
          Back to store
        </Link>
      </main>
    );
  }

  const listing: OrderListing = {
    id: row.id,
    title: row.title,
    priceKobo: row.price_kobo,
    type: row.type === 'digital' ? 'digital' : 'product',
    fileName: row.digital_file_name,
  };
  return <OrderForm slug={params.slug} listing={listing} />;
}
