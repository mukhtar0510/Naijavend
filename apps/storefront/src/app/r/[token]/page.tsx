// Rider page (T09): /r/<private token>, sent by the seller on WhatsApp.
// No account. Shows where to go and lets the rider move the delivery forward
// and finish with the buyer's 4-digit code. The link stops working when the
// seller changes rider.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, MessageCircle, Navigation, Phone, StickyNote } from 'lucide-react';
import { formatNaira, orderRef } from '@idevtenancy/shared';
import { supabaseService } from '@/lib/supabase';
import { STATUS_LABEL, type DeliveryStatus } from '@/lib/delivery';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { zoneLabel } from '@/lib/deliveryZones';
import { RiderActions } from './RiderActions';
import '../../../styles/dispatch.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Delivery', robots: { index: false, follow: false } };

export default async function RiderPage({ params }: { params: { token: string } }) {
  const token = (params.token ?? '').slice(0, 64);
  if (token.length < 20) notFound();
  const svc = supabaseService();
  const { data: d } = await svc
    .from('deliveries')
    .select('id, status, eta_window, order_id, stores(name, whatsapp_number, address, latitude, longitude), riders(name)')
    .eq('rider_token', token)
    .maybeSingle();
  if (!d) notFound();
  const one = <T,>(v: T | T[] | null): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);
  const store = one(d.stores as never) as { name: string; whatsapp_number: string | null; address: string | null; latitude: number | null; longitude: number | null } | null;
  const rider = one(d.riders as never) as { name: string } | null;

  const { data: o } = await svc
    .from('orders')
    .select('id, customer_name, customer_phone, total_kobo, payment_status, payment_method, delivery_method, delivery_zone, delivery_area, delivery_address, delivery_landmark, delivery_note, drop_lat, drop_lng')
    .eq('id', d.order_id)
    .maybeSingle();
  if (!o) notFound();

  const area = ILORIN_AREAS.find((a) => a.id === o.delivery_area)?.label;
  const where = [o.delivery_address, o.delivery_landmark, o.delivery_method === 'zone' ? zoneLabel(o.delivery_zone) : area]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const pin = o.drop_lat != null && o.drop_lng != null ? `${Number(o.drop_lat).toFixed(6)},${Number(o.drop_lng).toFixed(6)}` : null;
  const collect = o.payment_method === 'cash_on_delivery' && o.payment_status !== 'paid';
  const phone = (o.customer_phone ?? '').trim();
  const status = d.status as DeliveryStatus;

  return (
    <main className="rdr">
      <p className="rdr-store">{store?.name} · delivery</p>
      <h1>
        {orderRef(o.id)} · {STATUS_LABEL[status]}
      </h1>
      {rider && <p className="muted">For {rider.name}</p>}

      <section className="card rdr-block">
        <h2>
          <MapPin size={16} aria-hidden /> Drop-off
        </h2>
        <p className="rdr-where">{where || 'Ask the buyer for directions'}</p>
        <p>
          {o.customer_name}
          {d.eta_window ? ` · expected ${d.eta_window}` : ''}
        </p>
        {o.delivery_note && (
          <p className="muted">
            <StickyNote size={14} aria-hidden /> {o.delivery_note}
          </p>
        )}
        <div className="rdr-links">
          {phone && (
            <>
              <a className="btn btn-outline" href={`tel:${phone}`}>
                <Phone size={16} aria-hidden /> Call buyer
              </a>
              <a className="btn btn-whatsapp" href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${o.customer_name}, I'm the rider from ${store?.name} with your order ${orderRef(o.id)}.`)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} aria-hidden /> WhatsApp
              </a>
            </>
          )}
          {pin && (
            <a className="btn btn-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${pin}`} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} aria-hidden /> Directions
            </a>
          )}
        </div>
      </section>

      <section className={collect ? 'card rdr-block is-collect' : 'card rdr-block'}>
        <h2>Money</h2>
        <p>
          {collect
            ? `Collect ${formatNaira(Number(o.total_kobo))} in cash from the buyer.`
            : o.payment_status === 'paid'
              ? 'Already paid. Collect nothing.'
              : 'Don’t collect money unless the store tells you to.'}
        </p>
      </section>

      <RiderActions token={token} status={status} />

      {store && (
        <p className="muted rdr-foot">
          Problem? Message {store.name}
          {store.whatsapp_number ? (
            <>
              {' '}
              on{' '}
              <a href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          ) : null}
          .
        </p>
      )}
    </main>
  );
}
