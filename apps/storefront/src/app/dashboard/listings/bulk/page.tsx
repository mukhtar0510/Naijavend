import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { BulkForm } from './BulkForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk add products' };

export default async function BulkListingsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');

  const membership = await getStaffMembership(sb);
  const store = membership ? null : await getOwnStore<{ id: string }>(sb, 'id');

  if (!store) {
    return (
      <main>
        <h1>Bulk add products</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">
          Set up my store
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>Bulk add products</h1>
      <p className="muted">
        The fastest way to fill a new store: paste your catalogue, add three products, and refine
        photos and descriptions afterwards.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <BulkForm storeId={store.id} />
      </div>
    </main>
  );
}
