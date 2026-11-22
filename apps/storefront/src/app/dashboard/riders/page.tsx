import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { RidersManager, type RiderRow } from './RidersManager';
import '../../../styles/dispatch.css';

export const dynamic = 'force-dynamic';

export default async function RidersPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  await redirectStaffToPos(sb);
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) {
    return (
      <main>
        <h1>Riders</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }
  const { data, error } = await sb.from('riders').select('id, name, phone, vehicle, active').eq('store_id', store.id).order('active', { ascending: false }).order('created_at');

  return (
    <main style={{ maxWidth: 820 }}>
      <h1>Riders</h1>
      <p className="dash-sub">
        The people who deliver for you. Assign them on the <Link href="/dashboard/dispatch">Dispatch board</Link>.
      </p>
      {error ? (
        <div className="alert alert-error">Riders aren&apos;t available yet. The delivery database update hasn&apos;t been applied.</div>
      ) : (
        <RidersManager riders={(data ?? []) as RiderRow[]} />
      )}
    </main>
  );
}
