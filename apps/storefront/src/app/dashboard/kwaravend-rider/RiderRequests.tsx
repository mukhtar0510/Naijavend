'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Phone, X } from 'lucide-react';

export interface RiderRequestRow {
  id: string;
  speed: 'standard' | 'express' | 'same_day';
  pickup: string;
  dropoff: string;
  note: string;
  status: 'requested' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  rider_name: string | null;
  rider_phone: string | null;
  admin_note: string;
  created_at: string;
}

const SPEED_LABEL = { standard: 'Standard', express: 'Express', same_day: 'Same-day' } as const;
const STATUS: Record<RiderRequestRow['status'], { label: string; cls: string }> = {
  requested: { label: 'Finding a rider', cls: 'badge badge-warning' },
  assigned: { label: 'Rider on the way', cls: 'badge badge-gold' },
  picked_up: { label: 'Picked up', cls: 'badge badge-gold' },
  delivered: { label: 'Delivered', cls: 'badge badge-success' },
  cancelled: { label: 'Cancelled', cls: 'badge' },
};

export function RiderRequests({
  active,
  speeds,
  storeAddress,
  orders,
  initial,
}: {
  active: boolean;
  speeds: Array<'standard' | 'express' | 'same_day'>;
  storeAddress: string;
  orders: Array<{ id: string; label: string }>;
  initial: RiderRequestRow[];
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [speed, setSpeed] = useState(speeds[0] ?? 'standard');
  const [pickup, setPickup] = useState(storeAddress);
  const [dropoff, setDropoff] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch('/api/dashboard/rider-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: orderId || undefined, speed, pickup, dropoff, note }),
      });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not request a rider.');
      setOk('Requested. Kwaravend will assign a rider shortly.');
      setDropoff('');
      setNote('');
      setOrderId('');
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm('Cancel this rider request?')) return;
    await fetch('/api/dashboard/rider-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id }) });
    router.refresh();
  }

  return (
    <>
      <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 16 }} aria-label="Request a Kwaravend rider">
        <h2 style={{ margin: 0, fontSize: 17 }}>Request a rider</h2>
        {orders.length > 0 && (
          <label className="rr-field">
            <span>For an order (optional)</span>
            <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} disabled={!active}>
              <option value="">Not linked to an order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="sdg-tabs" role="radiogroup" aria-label="Speed" style={{ justifySelf: 'start' }}>
          {speeds.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={speed === s} className={`sdg-tab${speed === s ? ' is-active' : ''}`} onClick={() => setSpeed(s)} disabled={!active}>
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="rr-field">
          <span>Pick up from</span>
          <input className="input" value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={300} disabled={!active} required />
        </label>
        <label className="rr-field">
          <span>Deliver to {orderId ? '(leave empty to use the order’s address)' : ''}</span>
          <input
            className="input"
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            maxLength={300}
            placeholder="Address, landmark, buyer’s name and phone"
            disabled={!active}
            required={!orderId}
          />
        </label>
        <label className="rr-field">
          <span>Note for the rider (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. fragile, call on arrival" disabled={!active} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!active || busy} style={{ justifySelf: 'start' }}>
          <Bike size={16} aria-hidden /> {busy ? 'Requesting…' : 'Request rider'}
        </button>
        {err && (
          <p role="alert" className="plan-err" style={{ margin: 0, color: 'var(--danger)' }}>
            {err}
          </p>
        )}
        {ok && (
          <p role="status" className="muted" style={{ margin: 0 }}>
            {ok}
          </p>
        )}
      </form>

      <h2 style={{ fontSize: 17, marginTop: 24 }}>Your requests</h2>
      {initial.length === 0 ? (
        <div className="empty-state">No rider requests yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {initial.map((r) => (
            <li key={r.id} className="card" style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={STATUS[r.status].cls}>{STATUS[r.status].label}</span>
                <span className="badge">{SPEED_LABEL[r.speed]}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {new Date(r.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>
                <strong>From</strong> {r.pickup} <strong>to</strong> {r.dropoff}
              </p>
              {r.note && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{r.note}</p>}
              {r.rider_name && (
                <p style={{ margin: 0, fontSize: 14 }}>
                  Rider: <strong>{r.rider_name}</strong>
                  {r.rider_phone && (
                    <>
                      {' · '}
                      <a href={`tel:${r.rider_phone}`}>
                        <Phone size={13} aria-hidden /> {r.rider_phone}
                      </a>
                    </>
                  )}
                </p>
              )}
              {r.admin_note && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Kwaravend: {r.admin_note}</p>}
              {(r.status === 'requested' || r.status === 'assigned') && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(r.id)} style={{ justifySelf: 'start' }}>
                  <X size={14} aria-hidden /> Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
