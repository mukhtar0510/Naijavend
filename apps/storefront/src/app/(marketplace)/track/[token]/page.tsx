// Public delivery tracking (BUILD.md T09): /track/<unguessable token>, no
// login. Shows status, timeline, rider first name, store contact, a small map
// and the buyer's handover code. No phone number or address of the buyer is
// shown here (the link can be forwarded), only what the buyer needs.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, KeyRound, MessageCircle, Phone, Store as StoreIcon, Truck } from 'lucide-react';
import { formatNaira, orderRef } from '@idevtenancy/shared';
import { supabaseService } from '@/lib/supabase';
import { STATUS_LABEL, firstName, type DeliveryStatus } from '@/lib/delivery';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { AutoRefresh } from './AutoRefresh';
import { TrackMapLazy } from './TrackMapLazy';
import '../../../../styles/dispatch.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Track your delivery', robots: { index: false, follow: false } };

const STEPS: DeliveryStatus[] = ['awaiting_dispatch', 'assigned', 'picked_up', 'in_transit', 'arrived', 'delivered'];
const VEHICLE: Record<string, string> = { bike: 'Okada', tricycle: 'Keke', car: 'Car', van: 'Van', foot: 'On foot' };

function when(iso: string) {
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export default async function TrackPage({ params }: { params: { token: string } }) {
  const token = (params.token ?? '').slice(0, 64);
  if (token.length < 20) notFound();
  const svc = supabaseService();
  const { data: d } = await svc
    .from('deliveries')
    .select(
      'id, status, eta_window, failure_reason, proof, delivered_at, updated_at, order_id, stores(name, slug, whatsapp_number, latitude, longitude), riders(name, phone, vehicle)',
    )
    .eq('tracking_token', token)
    .maybeSingle();
  if (!d) notFound();

  const one = <T,>(v: T | T[] | null): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);
  const store = one(d.stores as never) as { name: string; slug: string; whatsapp_number: string | null; latitude: number | null; longitude: number | null } | null;
  const rider = one(d.riders as never) as { name: string; phone: string; vehicle: string } | null;
  const status = d.status as DeliveryStatus;

  const [{ data: order }, { data: events }, { data: secret }] = await Promise.all([
    svc
      .from('orders')
      .select('id, total_kobo, delivery_area, drop_lat, drop_lng, order_items(quantity, listings(title))')
      .eq('id', d.order_id)
      .maybeSingle(),
    svc.from('delivery_events').select('status, note, actor, created_at').eq('delivery_id', d.id).order('created_at', { ascending: false }),
    status === 'delivered' || status === 'returned'
      ? Promise.resolve({ data: null })
      : svc.from('delivery_secrets').select('otp').eq('delivery_id', d.id).maybeSingle(),
  ]);

  const done = status === 'delivered' || status === 'returned';
  const failed = status === 'failed_attempt';
  const stepIdx = STEPS.indexOf(status);
  const area = ILORIN_AREAS.find((a) => a.id === (order as { delivery_area?: string } | null)?.delivery_area);
  const drop =
    order?.drop_lat != null && order?.drop_lng != null
      ? { lat: Number(order.drop_lat), lng: Number(order.drop_lng), approx: false }
      : area
        ? { lat: area.lat, lng: area.lng, approx: true }
        : null;
  const storePt = store?.latitude != null && store?.longitude != null ? { lat: Number(store.latitude), lng: Number(store.longitude) } : null;
  const items = ((order?.order_items as unknown as Array<{ quantity: number; listings: { title: string } | null }>) ?? []).map((i) => ({
    title: i.listings?.title ?? 'Item',
    qty: i.quantity,
  }));
  const storeWa = store?.whatsapp_number?.replace(/\D/g, '');
  const ref = orderRef(d.order_id);

  return (
    <main className="trk">
      {!done && <AutoRefresh seconds={30} />}
      <header className={`trk-head is-${status}`}>
        <span className="trk-head-ico" aria-hidden>
          {status === 'delivered' ? <CheckCircle2 size={26} /> : failed ? <AlertTriangle size={26} /> : <Truck size={26} />}
        </span>
        <div>
          <p className="trk-ref">
            {store?.name ?? 'Your order'} · <span className="mono">{ref}</span>
          </p>
          <h1>{STATUS_LABEL[status]}</h1>
          {d.eta_window && !done && (
            <p className="trk-eta">
              <Clock size={14} aria-hidden /> Expected {d.eta_window}
            </p>
          )}
          {status === 'delivered' && d.delivered_at && <p className="trk-eta">{when(d.delivered_at)}</p>}
        </div>
      </header>

      {!failed && status !== 'returned' && (
        <ol className="trk-steps" aria-label="Delivery progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i < stepIdx ? 'is-done' : i === stepIdx ? 'is-current' : ''} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="trk-dot" aria-hidden />
              <span>{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {failed && (
        <section className="card trk-fail">
          <h2>
            <AlertTriangle size={17} aria-hidden /> The rider couldn&apos;t deliver this time
          </h2>
          {d.failure_reason && <p>Reason: {d.failure_reason}.</p>}
          <p>The store will contact you to arrange another time. You can also message them now.</p>
          {storeWa && (
            <a className="btn btn-whatsapp" href={`https://wa.me/${storeWa}?text=${encodeURIComponent(`Hello ${store?.name}, about my order ${ref}: can we reschedule the delivery?`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden /> Reschedule on WhatsApp
            </a>
          )}
        </section>
      )}

      {secret?.otp && (
        <section className="card trk-code" aria-label="Handover code">
          <KeyRound size={20} aria-hidden />
          <div>
            <p>Give this code to the rider when you have your order</p>
            <strong className="mono">{secret.otp.split('').join(' ')}</strong>
            <span>Don&apos;t share it before you receive the order.</span>
          </div>
        </section>
      )}

      {rider && ['assigned', 'picked_up', 'in_transit', 'arrived'].includes(status) && (
        <section className="card trk-rider">
          <span className="trk-rider-ico" aria-hidden>
            <Truck size={18} />
          </span>
          <div>
            <strong>{firstName(rider.name)}</strong>
            <span className="muted">Your rider · {VEHICLE[rider.vehicle] ?? 'Rider'}</span>
          </div>
          <a className="btn btn-outline btn-sm" href={`tel:${rider.phone}`}>
            <Phone size={14} aria-hidden /> Call
          </a>
          <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${rider.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} aria-hidden />
          </a>
        </section>
      )}

      {(storePt || drop) && <TrackMapLazy store={storePt} drop={drop} />}

      <section className="card trk-timeline" aria-label="Timeline">
        <h2>Timeline</h2>
        <ol>
          {(events ?? []).map((e, i) => (
            <li key={i}>
              <span className="trk-when">{when(e.created_at as string)}</span>
              <span>
                <strong>{STATUS_LABEL[e.status as DeliveryStatus] ?? e.status}</strong>
                {e.note ? <em> · {e.note as string}</em> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card trk-summary">
        <h2>Your order</h2>
        <ul>
          {items.map((i, k) => (
            <li key={k}>
              {i.qty} × {i.title}
            </li>
          ))}
        </ul>
        {order && <p className="mono">Total {formatNaira(Number(order.total_kobo))}</p>}
        <div className="trk-store">
          <StoreIcon size={16} aria-hidden /> {store?.name}
          {storeWa && (
            <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${storeWa}?text=${encodeURIComponent(`Hello ${store?.name}, about my order ${ref}`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} aria-hidden /> Message store
            </a>
          )}
          {store?.slug && (
            <Link className="btn btn-ghost btn-sm" href={`/s/${store.slug}`}>
              Visit store
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
