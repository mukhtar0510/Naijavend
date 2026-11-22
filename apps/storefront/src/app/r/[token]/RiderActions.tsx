'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MapPin, PackageCheck, Truck, XCircle } from 'lucide-react';

type S = 'awaiting_dispatch' | 'assigned' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'failed_attempt' | 'returned';

const REASONS = ['Buyer not reachable', 'Wrong or unclear address', 'Buyer refused the order', 'Buyer asked to reschedule', 'Item damaged'];

export function RiderActions({ token, status }: { token: string; status: S }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');

  async function go(next: S, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/rider/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ next, ...extra }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Could not save.');
      setFailing(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'delivered') {
    return (
      <section className="card rdr-block is-done">
        <CheckCircle2 size={20} aria-hidden /> Delivered. Thank you.
      </section>
    );
  }
  if (status === 'returned' || status === 'awaiting_dispatch' || status === 'failed_attempt') {
    return (
      <section className="card rdr-block">
        <p>{status === 'failed_attempt' ? 'Marked as failed. The store will arrange the next try.' : 'Nothing to do on this delivery right now.'}</p>
      </section>
    );
  }

  return (
    <section className="card rdr-block rdr-actions">
      <h2>Update</h2>
      {status === 'assigned' && (
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => go('picked_up')}>
          <PackageCheck size={18} aria-hidden /> I&apos;ve picked it up
        </button>
      )}
      {status === 'picked_up' && (
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => go('in_transit')}>
          <Truck size={18} aria-hidden /> I&apos;m on the way
        </button>
      )}
      {status === 'in_transit' && (
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => go('arrived')}>
          <MapPin size={18} aria-hidden /> I&apos;ve arrived
        </button>
      )}
      {status === 'arrived' && (
        <div className="rdr-otp">
          <label>
            Buyer&apos;s 4-digit code
            <input
              className="input mono"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="0000"
            />
          </label>
          <button type="button" className="btn btn-cta btn-lg" disabled={busy || otp.length !== 4} onClick={() => go('delivered', { otp })}>
            <CheckCircle2 size={18} aria-hidden /> Confirm delivery
          </button>
          <p className="muted">Hand over the order, then ask the buyer for the code on their tracking page.</p>
        </div>
      )}
      {!failing ? (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setFailing(true)}>
          <XCircle size={16} aria-hidden /> Couldn&apos;t deliver
        </button>
      ) : (
        <div className="dsp-sub">
          <div className="dsp-reasons" role="radiogroup" aria-label="Why?">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className={reason === r ? 'chip is-active' : 'chip'} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" disabled={busy || !reason} onClick={() => go('failed_attempt', { reason })}>
            Report failed attempt
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setFailing(false)}>
            Cancel
          </button>
        </div>
      )}
      {err && (
        <p role="alert" className="dsp-err">
          {err}
        </p>
      )}
    </section>
  );
}
