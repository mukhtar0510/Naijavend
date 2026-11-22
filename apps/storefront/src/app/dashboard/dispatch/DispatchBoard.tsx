'use client';

// Dispatch board (BUILD.md T09, REDESIGN §5 T09): deliveries in columns by
// status, swipeable on phones. One primary action per card; failures need a
// reason; "Delivered" needs the buyer's 4-digit code (or a seller
// confirmation with a note). WhatsApp links are pre-filled, never auto-sent.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  RotateCcw,
  Send,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';

export type DStatus =
  | 'awaiting_dispatch'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'failed_attempt'
  | 'returned';

export interface BoardDelivery {
  id: string;
  status: DStatus;
  trackingToken: string;
  riderToken: string | null;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  eta: string;
  failureReason: string;
  updatedAt: string;
  orderRef: string;
  buyerName: string;
  buyerPhone: string;
  where: string;
  pin: string | null;
  totalLabel: string;
  paid: boolean;
}

export interface BoardRider {
  id: string;
  name: string;
}

const LABEL: Record<DStatus, string> = {
  awaiting_dispatch: 'Waiting for a rider',
  assigned: 'Rider assigned',
  picked_up: 'Picked up',
  in_transit: 'On the way',
  arrived: 'Arrived',
  delivered: 'Delivered',
  failed_attempt: 'Failed attempt',
  returned: 'Returned',
};

const COLUMNS: Array<{ id: string; title: string; statuses: DStatus[] }> = [
  { id: 'waiting', title: 'Waiting', statuses: ['awaiting_dispatch', 'failed_attempt'] },
  { id: 'assigned', title: 'Assigned', statuses: ['assigned'] },
  { id: 'moving', title: 'On the way', statuses: ['picked_up', 'in_transit', 'arrived'] },
  { id: 'done', title: 'Done', statuses: ['delivered', 'returned'] },
];

const REASONS = ['Buyer not reachable', 'Wrong or unclear address', 'Buyer refused the order', 'Buyer asked to reschedule', 'Item damaged'];

function wa(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function DispatchBoard({ deliveries, riders, storeName }: { deliveries: BoardDelivery[]; riders: BoardRider[]; storeName: string }) {
  const [tab, setTab] = useState('waiting');
  const counts = useMemo(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, deliveries.filter((d) => c.statuses.includes(d.status)).length])),
    [deliveries],
  );
  return (
    <>
      {/* Phones: one column at a time, chosen with chips. Desktop: all columns. */}
      <div className="dsp-tabs" role="tablist" aria-label="Delivery columns">
        {COLUMNS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} className={tab === c.id ? 'chip is-active' : 'chip'} onClick={() => setTab(c.id)}>
            {c.title} <span className="chip-count">{counts[c.id]}</span>
          </button>
        ))}
      </div>
      <div className="dsp-board">
        {COLUMNS.map((c) => {
          const items = deliveries.filter((d) => c.statuses.includes(d.status));
          return (
            <section key={c.id} className={tab === c.id ? 'dsp-col is-current' : 'dsp-col'} aria-label={c.title}>
              <h2>
                {c.title} <span className="chip-count">{items.length}</span>
              </h2>
              {items.length === 0 ? (
                <p className="dsp-empty">Nothing here.</p>
              ) : (
                items.map((d) => <Card key={d.id} d={d} riders={riders} storeName={storeName} />)
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Card({ d, riders, storeName }: { d: BoardDelivery; riders: BoardRider[]; storeName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rider, setRider] = useState(d.riderId ?? '');
  const [eta, setEta] = useState(d.eta);
  const [mode, setMode] = useState<'none' | 'fail' | 'deliver'>('none');
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [copied, setCopied] = useState(false);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const trackUrl = `${origin}/track/${d.trackingToken}`;
  const riderUrl = d.riderToken ? `${origin}/r/${d.riderToken}` : null;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/dashboard/deliveries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliveryId: d.id, ...body }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Could not save.');
      setMode('none');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = (next: DStatus, extra: Record<string, unknown> = {}) => send({ action: 'status', next, ...extra });

  return (
    <article className={`card dsp-card is-${d.status}`}>
      <header className="dsp-card-head">
        <strong className="mono">{d.orderRef}</strong>
        <span className={`badge dsp-badge is-${d.status}`}>{LABEL[d.status]}</span>
      </header>
      <p className="dsp-line">
        <UserRound size={14} aria-hidden /> {d.buyerName} · <span className="mono">{d.totalLabel}</span> {d.paid ? '· paid' : '· not paid yet'}
      </p>
      {d.where && (
        <p className="dsp-line">
          <MapPin size={14} aria-hidden /> {d.where}
        </p>
      )}
      {d.riderName && (
        <p className="dsp-line">
          <Truck size={14} aria-hidden /> {d.riderName}
          {d.eta ? (
            <>
              {' '}
              · <Clock size={13} aria-hidden /> {d.eta}
            </>
          ) : null}
        </p>
      )}
      {d.status === 'failed_attempt' && d.failureReason && <p className="dsp-line is-warn">{d.failureReason}</p>}

      {/* Contact + links */}
      <div className="dsp-links">
        {d.buyerPhone && (
          <>
            <a className="btn btn-outline btn-sm" href={`tel:${d.buyerPhone}`} aria-label={`Call ${d.buyerName}`}>
              <Phone size={14} aria-hidden />
            </a>
            <a
              className="btn btn-whatsapp btn-sm"
              href={wa(d.buyerPhone, `Hello ${d.buyerName}, this is ${storeName}. Follow your order ${d.orderRef} here: ${trackUrl}`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={14} aria-hidden /> Send tracking
            </a>
          </>
        )}
        {d.pin && (
          <a className="btn btn-outline btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${d.pin}`} target="_blank" rel="noopener noreferrer">
            <Navigation size={14} aria-hidden /> Pin
          </a>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(trackUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* blocked */
            }
          }}
        >
          <Copy size={14} aria-hidden /> {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      {/* Primary action per stage */}
      <div className="dsp-actions">
        {(d.status === 'awaiting_dispatch' || d.status === 'failed_attempt' || d.status === 'assigned') && (
          <div className="dsp-assign">
            <select className="input" value={rider} onChange={(e) => setRider(e.target.value)} aria-label="Rider">
              <option value="">{riders.length ? 'Pick a rider' : 'Add riders first'}</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <input className="input" value={eta} onChange={(e) => setEta(e.target.value)} placeholder="When, e.g. 2–4pm" aria-label="Expected time" maxLength={60} />
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !rider} onClick={() => send({ action: 'assign', riderId: rider, eta })}>
              {d.status === 'assigned' ? 'Update' : d.status === 'failed_attempt' ? 'Try again' : 'Assign'}
            </button>
          </div>
        )}
        {d.status === 'assigned' && riderUrl && d.riderPhone && (
          <a
            className="btn btn-whatsapp btn-sm"
            href={wa(d.riderPhone, `${storeName}: delivery ${d.orderRef} to ${d.where || d.buyerName}. Open this link to update it and finish with the buyer's code: ${riderUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send size={14} aria-hidden /> Send link to rider
          </a>
        )}
        {d.status === 'assigned' && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => status('picked_up')}>
              <PackageCheck size={14} aria-hidden /> Picked up
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => send({ action: 'assign', riderId: null })}>
              Unassign
            </button>
          </>
        )}
        {d.status === 'picked_up' && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => status('in_transit')}>
            <Truck size={14} aria-hidden /> On the way
          </button>
        )}
        {d.status === 'in_transit' && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => status('arrived')}>
            <MapPin size={14} aria-hidden /> Arrived
          </button>
        )}
        {d.status === 'arrived' && mode !== 'deliver' && (
          <button type="button" className="btn btn-cta btn-sm" disabled={busy} onClick={() => setMode('deliver')}>
            <CheckCircle2 size={14} aria-hidden /> Delivered
          </button>
        )}
        {['picked_up', 'in_transit', 'arrived'].includes(d.status) && mode !== 'fail' && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMode('fail')}>
            <XCircle size={14} aria-hidden /> Failed
          </button>
        )}
        {d.status === 'failed_attempt' && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => status('returned')}>
            <RotateCcw size={14} aria-hidden /> Returned to store
          </button>
        )}
      </div>

      {mode === 'deliver' && (
        <div className="dsp-sub">
          <label className="dsp-field">
            Buyer&apos;s 4-digit code
            <input className="input mono" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="0000" />
          </label>
          <button type="button" className="btn btn-cta btn-sm" disabled={busy || otp.length !== 4} onClick={() => status('delivered', { otp })}>
            Confirm with code
          </button>
          <details>
            <summary>No code? Confirm another way</summary>
            <input className="input" value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="e.g. Buyer confirmed on a call" maxLength={200} />
            <button type="button" className="btn btn-outline btn-sm" disabled={busy || confirmNote.trim().length < 4} onClick={() => status('delivered', { sellerConfirm: true, note: confirmNote })}>
              Mark delivered
            </button>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Shown on the buyer&apos;s timeline as &ldquo;Confirmed by seller&rdquo; with your note.
            </p>
          </details>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('none')}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'fail' && (
        <div className="dsp-sub">
          <div className="dsp-reasons" role="radiogroup" aria-label="Why did it fail?">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className={reason === r ? 'chip is-active' : 'chip'} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !reason} onClick={() => status('failed_attempt', { reason })}>
            Save failed attempt
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('none')}>
            Cancel
          </button>
        </div>
      )}

      {err && (
        <p role="alert" className="dsp-err">
          {err}
        </p>
      )}
    </article>
  );
}
