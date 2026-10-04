// AI Studio — seller-facing AI tools: grounded business assistant chat and
// AI-drafted social posts. Server wrapper guards auth + store, matching the
// other dashboard pages; the interactivity lives in the client component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { AiStudio } from './AiStudio';

export const dynamic = 'force-dynamic';

export default async function AiStudioPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too

  const store = await getOwnStore<{ name: string }>(sb, 'name');
  if (!store) {
    return (
      <main>
        <h1>AI Studio</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">Set up my store</Link>
      </main>
    );
  }

  return <AiStudio storeName={store.name} />;
}
