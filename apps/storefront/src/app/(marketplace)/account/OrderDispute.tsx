'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// "Report a problem" on one order — opens a small form, files the dispute via
// /api/disputes, then shows the report's live status (open → resolved/refunded/
// rejected) with the store's note when they respond.
interface Dispute {
  id: string;
  reason: string;
  message: string;
  status: 'open' | 'resolved' | 'refunded' | 'rejected';
  seller_note: string;
  refund_kobo: number;
  created_at: string;
  updated_at: string;
}

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'not_received', label: 'Never received' },
  { value: 'wrong_item', label: 'Wrong item delivered' },
  { value: 'damaged', label: 'Item arrived damaged' },
  { value: 'defective', label: 'Item does not work' },
  { value: 'fake', label: 'Not as described / fake' },
  { value: 'refund_request', label: 'I want a refund' },
  { value: 'other', label: 'Something else' },
];

const STATUS_LABEL: Record<Dispute['status'], string> = {
  open: 'Report sent — store reviewing',
  resolved: 'Resolved',
  refunded: 'Refunded',
  rejected: 'Reviewed — no refund',
};

const STATUS_BADGE: Record<Dispute['status'], string> = {
  open: 'badge-black',
  resolved: 'badge-blue',
  refunded: 'badge-success',
  rejected: 'badge-danger',
};

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function OrderDispute({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('not_received');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/disputes?orderId=${encodeURIComponent(orderId)}`)
      .then((r) => (r.ok ? r.json() : { dispute: null }))
      .then((body) => {
        if (cancelled) return;
        setDispute(body.dispute ?? null);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not send your report.');
      setDone(true);
      setOpen(false);
      // Refresh the status strip with the row we just created.
      const again = await fetch(`/api/disputes?orderId=${encodeURIComponent(orderId)}`).catch(() => null);
      if (again?.ok) {
        const b = await again.json();
        setDispute(b.dispute ?? null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  // Existing report: show its status + the store's reply.
  if (dispute) {
    return (
      <div className="dispute-strip" aria-live="polite">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_BADGE[dispute.status]}`}>{STATUS_LABEL[dispute.status]}</span>
          {dispute.status === 'refunded' && dispute.refund_kobo > 0 && (
            <span className="price" style={{ fontSize: 13.5 }}>{naira(dispute.refund_kobo)} refunded</span>
          )}
        </div>
        {dispute.seller_note && (
          <p className="dispute-note">🏪 {dispute.seller_note}</p>
        )}
        {dispute.status === 'open' && (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
            Sent {new Date(dispute.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} — the store has been notified.
          </p>
        )}
      </div>
    );
  }

  const reportable = ['paid', 'fulfilled'].includes(orderStatus);

  if (!reportable) {
    // Pending orders can be cancelled, refunded ones are closed — no report button.
    return done ? (
      <div className="dispute-strip">
        <span className="badge badge-black">Report sent</span>
      </div>
    ) : null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-sm dispute-report-btn"
        onClick={() => setOpen(true)}
      >
        ⚑ Report a problem
      </button>
    );
  }

  return (
    <form className="dispute-form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor={`dr-${orderId}`}>What went wrong?</label>
        <select id={`dr-${orderId}`} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`dm-${orderId}`}>Details (optional)</label>
        <textarea
          id={`dm-${orderId}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What happened? Dates, amounts and what you expected help us resolve it faster."
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      <p className="hint" style={{ margin: '8px 0 0' }}>
        The store sees your report and can resolve it or refund you — you&apos;ll get an alert either way.
        Need help now?{' '}
        <Link href="/account/chats">Message the store</Link>.
      </p>
    </form>
  );
}
