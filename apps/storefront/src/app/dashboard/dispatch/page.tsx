import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { redirectStaffToPos } from '@/lib/staff';
import { formatNaira, orderRef } from '@idevtenancy/shared';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { zoneLabel } from '@/lib/deliveryZones';
import { DispatchBoard, type BoardDelivery, type BoardRider, type DStatus } from './DispatchBoard';
import { CreateDeliveryButton } from './CreateDeliveryButton';
import '../../../styles/dispatch.css';

export const dynamic = 'force-dynamic';

type OrderJoin = {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  total_kobo: number;
  payment_status?: string | null;
  delivery_method?: string | null;
  delivery_zone?: string | null;
  delivery_area?: string | null;
  delivery_address?: string | null;
  delivery_landmark?: string | null;
  drop_lat?: number | null;
  drop_lng?: number | null;
};
type Row = {
  id: string;
  status: DStatus;
  tracking_token: string;
  rider_token: string | null;
  rider_id: string | null;
  eta_window: string;
  failure_reason: string;
  updated_at: string;
  orders: OrderJoin | OrderJoin[] | null;
  riders: { name: string; phone: string } | Array<{ name: string; phone: string }> | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);

function where(o: OrderJoin): string {
  const area = ILORIN_AREAS.find((a) => a.id === o.delivery_area)?.label;
  return [o.delivery_address, o.delivery_landmark, o.delivery_method === 'zone' ? zoneLabel(o.delivery_zone) : area]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

export default async function DispatchPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  await redirectStaffToPos(sb);
  const store = await getOwnStore<{ id: string; name: string }>(sb, 'id, name');
  if (!store) {
    return (
      <main>
        <h1>Dispatch</h1>
        <p className="muted">Create your store first.</p>
      </main>
    );
  }

  const sel =
    'id, status, tracking_token, rider_token, rider_id, eta_window, failure_reason, updated_at, orders(id, customer_name, customer_phone, total_kobo, payment_status, delivery_method, delivery_zone, delivery_area, delivery_address, delivery_landmark, drop_lat, drop_lng), riders(name, phone)';
  const [active, done, ridersRes, ordersRes] = await Promise.all([
    sb.from('deliveries').select(sel).eq('store_id', store.id).not('status', 'in', '(delivered,returned)').order('updated_at', { ascending: false }).limit(100),
    sb.from('deliveries').select(sel).eq('store_id', store.id).in('status', ['delivered', 'returned']).order('updated_at', { ascending: false }).limit(20),
    sb.from('riders').select('id, name').eq('store_id', store.id).eq('active', true).order('name'),
    sb
      .from('orders')
      .select('id, customer_name, created_at, delivery_method, status')
      .eq('store_id', store.id)
      .in('delivery_method', ['rider', 'courier', 'zone'])
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (active.error) {
    return (
      <main>
        <h1>Dispatch</h1>
        <div className="alert alert-error">Dispatch isn&apos;t available yet. The delivery database update hasn&apos;t been applied.</div>
      </main>
    );
  }

  const rows = [...((active.data ?? []) as unknown as Row[]), ...((done.data ?? []) as unknown as Row[])];
  const deliveries: BoardDelivery[] = rows.flatMap((r) => {
    const o = one(r.orders);
    if (!o) return [];
    const rider = one(r.riders);
    return [
      {
        id: r.id,
        status: r.status,
        trackingToken: r.tracking_token,
        riderToken: r.rider_token,
        riderId: r.rider_id,
        riderName: rider?.name ?? null,
        riderPhone: rider?.phone ?? null,
        eta: r.eta_window,
        failureReason: r.failure_reason,
        updatedAt: r.updated_at,
        orderRef: orderRef(o.id),
        buyerName: o.customer_name,
        buyerPhone: (o.customer_phone ?? '').trim(),
        where: where(o),
        pin: o.drop_lat != null && o.drop_lng != null ? `${o.drop_lat.toFixed(6)},${o.drop_lng.toFixed(6)}` : null,
        totalLabel: formatNaira(o.total_kobo),
        paid: o.payment_status === 'paid',
      },
    ];
  });
  const withDelivery = new Set(rows.map((r) => one(r.orders)?.id));
  const missing = (ordersRes.data ?? []).filter((o) => !withDelivery.has(o.id));
  const riders = (ridersRes.data ?? []) as BoardRider[];

  return (
    <main className="dsp">
      <h1>Dispatch</h1>
      <p className="dash-sub">
        Assign riders, follow each delivery and finish with the buyer&apos;s code. Buyers see every step on their tracking
        page. {riders.length === 0 && <Link href="/dashboard/riders">Add your riders first.</Link>}
      </p>

      {missing.length > 0 && (
        <section className="card dsp-missing" aria-label="Orders without a delivery">
          <h2>Delivery orders not on the board yet</h2>
          <ul>
            {missing.map((o) => (
              <li key={o.id}>
                <span>
                  <strong className="mono">{orderRef(o.id)}</strong> · {o.customer_name}
                </span>
                <CreateDeliveryButton orderId={o.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {deliveries.length === 0 && missing.length === 0 ? (
        <div className="empty-state">
          No deliveries yet. When a buyer chooses rider, courier or campus delivery, the order appears here.
        </div>
      ) : (
        <DispatchBoard deliveries={deliveries} riders={riders} storeName={store.name} />
      )}
    </main>
  );
}
