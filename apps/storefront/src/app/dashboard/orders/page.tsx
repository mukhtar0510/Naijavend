import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { getStaffMembership } from '@/lib/staff';
import { formatNaira, orderRef } from '@idevtenancy/shared';
import { MapPin, MessageCircle, Navigation, Phone, StickyNote, Store as StoreIcon, Truck } from 'lucide-react';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { zoneLabel } from '@/lib/deliveryZones';
import { OrderActions } from './OrderActions';
import { ConfirmPayment } from './ConfirmPayment';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_LABEL, paymentStatusOf } from '@/lib/payments';
import type { PaymentMethod } from '@/lib/payments';
import type { Order } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

// Delivery details saved at checkout (20261121110000 migration). Optional on
// the type so older rows and a not-yet-migrated database still render.
type DeliveryFields = {
  customer_phone?: string | null;
  delivery_method?: string | null;
  delivery_zone?: string | null;
  delivery_area?: string | null;
  delivery_address?: string | null;
  delivery_landmark?: string | null;
  delivery_note?: string | null;
  drop_lat?: number | null;
  drop_lng?: number | null;
};

const METHOD_LABEL: Record<string, string> = {
  pickup: 'Pickup at the store',
  rider: 'Rider delivery',
  courier: 'Courier',
  zone: 'Campus / landmark delivery',
};

function DeliveryInfo({ o }: { o: DeliveryFields & { customer_name: string; id: string; order_code?: string | null } }) {
  const method = o.delivery_method ?? '';
  const area = ILORIN_AREAS.find((a) => a.id === o.delivery_area)?.label;
  const where = [o.delivery_address, o.delivery_landmark, method === 'zone' ? zoneLabel(o.delivery_zone) : area]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const pin = o.drop_lat != null && o.drop_lng != null ? `${o.drop_lat.toFixed(6)},${o.drop_lng.toFixed(6)}` : null;
  const phone = (o.customer_phone ?? '').trim();
  return (
    <div className="ord-delivery">
      <p>
        {method === 'pickup' ? <StoreIcon size={14} aria-hidden /> : <Truck size={14} aria-hidden />}{' '}
        <strong>{METHOD_LABEL[method] ?? 'Arrange pickup or delivery with the buyer'}</strong>
        {where && method !== 'pickup' && (
          <>
            {' '}
            · <MapPin size={14} aria-hidden /> {where}
          </>
        )}
      </p>
      {o.delivery_note?.trim() && (
        <p className="muted">
          <StickyNote size={14} aria-hidden /> &ldquo;{o.delivery_note.trim()}&rdquo;
        </p>
      )}
      <p className="ord-delivery-actions">
        {phone && (
          <>
            <a className="btn btn-outline btn-sm" href={`tel:${phone}`}>
              <Phone size={14} aria-hidden /> Call
            </a>
            <a
              className="btn btn-whatsapp btn-sm"
              href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${o.customer_name}, about your order ${(o.order_code ?? orderRef(o.id))}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={14} aria-hidden /> WhatsApp
            </a>
          </>
        )}
        {pin && (
          <a
            className="btn btn-outline btn-sm"
            href={`https://www.google.com/maps/dir/?api=1&destination=${pin}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={14} aria-hidden /> Directions to the pin
          </a>
        )}
      </p>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-black',
  // Money is in: paid and fulfilled read Naija green, not generic blue/green.
  paid: 'badge-naija',
  fulfilled: 'badge-naija',
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
      <p className="muted">
        Money and fulfilment are tracked separately. When cash, a transfer or pickup payment
        actually reaches you, confirm it here — Kwaravend never charges the buyer.
      </p>
      {(orders as Order[] | null)?.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {(orders as Order[]).map((o) => {
            const pay = paymentStatusOf(o);
            return (
              <div key={o.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span className={`badge ${STATUS_BADGE[o.status] ?? ''}`}>{o.status}</span>{' '}
                  <span className={`badge ${PAYMENT_STATUS_BADGE[pay]}`}>{PAYMENT_STATUS_LABEL[pay]}</span>{' '}
                  <strong className="mono">{(o.order_code ?? orderRef(o.id))}</strong>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    {o.customer_name} · <span style={{ color: 'var(--naija)', fontWeight: 600 }}>{formatNaira(o.total_kobo)}</span> ·{' '}
                    {PAYMENT_METHOD_LABEL[(o.payment_method ?? '') as PaymentMethod]} ·{' '}
                    {new Date(o.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                  </p>
                  <DeliveryInfo o={o as Order & DeliveryFields} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {pay !== 'paid' && pay !== 'refunded' && <ConfirmPayment orderId={o.id} />}
                  <OrderActions orderId={o.id} status={o.status} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No orders yet. Share your store link on WhatsApp to get your first sale.</div>
      )}
    </main>
  );
}
