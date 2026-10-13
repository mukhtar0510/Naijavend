'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'scam', label: 'Possible scam' },
  { value: 'fake_goods', label: 'Fake or counterfeit goods' },
  { value: 'no_response', label: 'Seller never responds' },
  { value: 'wrong_product', label: 'Wrong product / bait and switch' },
  { value: 'abuse', label: 'Abusive behaviour' },
  { value: 'other', label: 'Something else' },
];

// "Report store" — opens a small modal, files against /api/reports/store.
// Signed-out visitors can still report (rate-limited by IP server-side).
export function ReportButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('scam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (details.trim().length < 10) {
      setError('Tell us what happened (at least 10 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, reason, message: details.trim() }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not send the report.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(true)}>
        ⚑ Report store
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={`Report ${storeName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <>
                <h3>Report sent</h3>
                <p className="muted">
                  Thanks — our team will review {storeName}. You'll hear from us if we need more detail.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <h3>Report {storeName}</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Reports are confidential. For money lost to a scam, also report to your bank and the
                  police cybercrime unit.
                </p>

                <label className="field-label" htmlFor="report-reason">
                  What's wrong?
                </label>
                <select
                  id="report-reason"
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <label className="field-label" htmlFor="report-details" style={{ marginTop: 10 }}>
                  What happened?
                </label>
                <textarea
                  id="report-details"
                  className="input"
                  rows={4}
                  maxLength={1000}
                  placeholder="Order number, amounts, what happened…"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  required
                />

                {error && (
                  <div className="alert alert-error" style={{ marginTop: 10 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    {busy ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
