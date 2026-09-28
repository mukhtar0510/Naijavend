import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { formatNaira } from '@idevtenancy/shared';
import { OrderActions } from './OrderActions';
import type { Order } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  paid: 'badge-blue',
  fulfilled: 'badge-success',
  cancelled: 'badge-danger',
};

export default async function OrdersPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too

  // Staff (managers) see their store's orders too; cashiers don't have this nav link.
  const membership = sb ? await getStaffMembership(sb) : null;
  const store = membership
    ? { id: membership.storeId }
    : await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) {
    return <main><h1>Orders</h1><p className="muted">Create your store first.</p></main>;
  }

  const { data: orders } = await sb
    .from('orders')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main>
      <h1>Orders</h1>
      <p className="muted">Payment status comes from the payment provider — you can fulfill or cancel, but never mark an order paid yourself.</p>
      {(orders as Order[] | null)?.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {(orders as Order[]).map((o) => (
            <div key={o.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span className={`badge ${STATUS_BADGE[o.status] ?? ''}`}>{o.status}</span>{' '}
                <strong className="mono">{o.id.slice(0, 8)}</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  {o.customer_name} · {formatNaira(o.total_kobo)} ·{' '}
                  {new Date(o.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <OrderActions orderId={o.id} status={o.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No orders yet. Share your store link on WhatsApp to get your first sale.</div>
      )}
    </main>
  );
}
