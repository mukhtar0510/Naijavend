'use client';

// Owner billing panel (22 Nov 2026): set the Kwaravend account sellers pay
// plans into, check receipts, switch plans on. Every action is audit-logged
// by /api/admin/billing.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye } from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';

interface PlanPayment {
  id: string;
  plan: string;
  months: number;
  rider_addon?: boolean;
  amount_kobo: number;
  reference: string;
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'rejected' | 'cancelled';
  proof_url: string | null;
  note: string | null;
  created_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  stores: { id: string; name: string; slug: string; plan: string | null; plan_expires_at: string | null } | null;
}
interface BillingBank {
  bankName: string;
  accountName: string;
  accountNumber: string;
}
const PAY_STATUS: Record<PlanPayment['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting for transfer', cls: 'badge' },
  awaiting_confirmation: { label: 'Receipt sent', cls: 'badge badge-warning' },
  paid: { label: 'Paid, plan on', cls: 'badge badge-success' },
  rejected: { label: 'Rejected', cls: 'badge badge-danger' },
  cancelled: { label: 'Cancelled', cls: 'badge' },
};
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const isOpen = (p: PlanPayment) => p.status === 'pending' || p.status === 'awaiting_confirmation';

export function AdminBilling() {
  const [payments, setPayments] = useState<PlanPayment[] | null>(null);
  const [bank, setBank] = useState<BillingBank | null>(null);
  const [form, setForm] = useState<BillingBank>({ bankName: '', accountName: '', accountNumber: '' });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/billing')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? 'Could not load.');
        const d = j as { payments: PlanPayment[]; bank: BillingBank | null };
        setPayments(d.payments);
        setBank(d.bank);
        if (d.bank) setForm(d.bank);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  async function post(key: string, body: Record<string, unknown>, done?: string) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/billing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Could not save.');
      if (done) setMsg(done);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!payments && !err) return <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />;
  const open = (payments ?? []).filter(isOpen);
  const closed = (payments ?? []).filter((p) => !isOpen(p));
  const paid = closed.filter((p) => p.status === 'paid');
  const paidTotal = paid.reduce((a, p) => a + Number(p.amount_kobo), 0);

  const row = (p: PlanPayment) => (
    <li key={p.id} className="card">
      <div className="admin-report-head">
        <strong>{p.stores?.name ?? 'Deleted store'}</strong>
        <span className="badge badge-gold">
          {p.plan === 'growth' ? 'Business' : p.plan === 'plus' ? 'Emirates Plus' : p.plan} · {p.months} mo{p.rider_addon ? ' + rider' : ''}
        </span>
        <span className={PAY_STATUS[p.status].cls}>{PAY_STATUS[p.status].label}</span>
        <span className="muted">{fmtDay(p.created_at)}</span>
      </div>
      <p>
        <span className="mono">{formatNaira(Number(p.amount_kobo))}</span> · narration <span className="mono">{p.reference}</span>
        {p.status === 'paid' && p.stores?.plan_expires_at && <span className="muted"> · plan runs to {fmtDay(p.stores.plan_expires_at)}</span>}
        {p.note && <span className="muted"> · {p.note}</span>}
      </p>
      <div className="admin-report-actions">
        {p.proof_url && (
          <a className="btn btn-outline btn-sm" href={p.proof_url} target="_blank" rel="noopener noreferrer">
            <Eye size={14} aria-hidden /> View receipt
          </a>
        )}
        {p.stores?.slug && (
          <a className="btn btn-ghost btn-sm" href={`/s/${p.stores.slug}`} target="_blank" rel="noopener noreferrer">
            Open store
          </a>
        )}
        {isOpen(p) && (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy === p.id}
              onClick={() => {
                const ok = window.confirm(
                  `Is ${formatNaira(Number(p.amount_kobo))} with narration ${p.reference} in the Kwaravend account? This switches on ${p.plan} for ${p.stores?.name ?? 'the store'}.`,
                );
                if (ok) void post(p.id, { action: 'confirm', id: p.id }, 'Plan switched on.');
              }}
            >
              <CheckCircle2 size={14} aria-hidden /> Money received, switch plan on
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy === p.id}
              onClick={() => {
                const note = window.prompt('Why are you rejecting it? The seller sees this.', 'Payment not received');
                if (note !== null) void post(p.id, { action: 'reject', id: p.id, note });
              }}
            >
              Reject
            </button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <section className="admin-panel" aria-label="Billing">
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <h3>Kwaravend account for plan payments</h3>
      {!bank && <div className="alert">Sellers can&apos;t buy a plan until you add the account they pay into.</div>}
      <form
        className="admin-bank-form"
        onSubmit={(e) => {
          e.preventDefault();
          void post('bank', { action: 'bank', ...form }, 'Bank details saved.');
        }}
      >
        <label>
          Bank
          <input className="input" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. GTBank" required />
        </label>
        <label>
          Account name
          <input className="input" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required />
        </label>
        <label>
          Account number
          <input
            className="input mono"
            inputMode="numeric"
            maxLength={10}
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy === 'bank'}>
          {busy === 'bank' ? 'Saving…' : bank ? 'Update account' : 'Save account'}
        </button>
      </form>

      <div className="admin-tiles">
        <div className="admin-tile">
          <span>To check</span>
          <strong>{open.length}</strong>
          <em>{open.filter((p) => p.status === 'awaiting_confirmation').length} with a receipt</em>
        </div>
        <div className="admin-tile">
          <span>Plans paid</span>
          <strong>{paid.length}</strong>
          <em>{formatNaira(paidTotal)}</em>
        </div>
      </div>

      <h3>Waiting for you</h3>
      {open.length === 0 ? <div className="empty-state">No plan payments to check.</div> : <ul className="admin-reports">{open.map(row)}</ul>}

      {closed.length > 0 && (
        <>
          <h3>History</h3>
          <ul className="admin-reports">{(showAll ? closed : closed.slice(0, 10)).map(row)}</ul>
          {closed.length > 10 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${closed.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
