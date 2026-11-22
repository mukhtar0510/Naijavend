'use client';

// Buy a plan: choose plan + months, transfer to Kwaravend with the reference,
// upload the receipt; the owner confirms and the plan switches on.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Copy, Landmark, Upload, X } from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';

export interface OpenPurchase {
  id: string;
  plan: string;
  planName: string;
  months: number;
  amountKobo: number;
  reference: string;
  status: 'pending' | 'awaiting_confirmation';
  proofUrl: string | null;
}

export interface PlanOption {
  id: string;
  name: string;
  priceKobo: number;
  current: boolean;
}

const MONTHS = [1, 3, 6, 12];

export function PlanCheckout({
  plans,
  open,
  bank,
  billingReady,
}: {
  plans: PlanOption[];
  open: OpenPurchase | null;
  bank: { bankName: string; accountName: string; accountNumber: string } | null;
  billingReady: boolean;
}) {
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function choose(plan: string) {
    setBusy(plan);
    setErr(null);
    try {
      const res = await fetch('/api/dashboard/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, months }),
      });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not start the purchase.');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!open) return;
    setBusy('cancel');
    try {
      await fetch('/api/dashboard/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id: open.id }) });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function upload() {
    if (!open || !file) return;
    setBusy('upload');
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('id', open.id);
      fd.append('file', file);
      const res = await fetch('/api/dashboard/plan/proof', { method: 'POST', body: fd });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not upload.');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* blocked */
    }
  }

  if (open) {
    return (
      <section className="card plan-buy" aria-label="Your plan purchase">
        <header>
          <h2>
            {open.planName} · {open.months} month{open.months === 1 ? '' : 's'}
          </h2>
          {open.status === 'awaiting_confirmation' ? (
            <span className="badge badge-warning">
              <Clock size={13} aria-hidden /> Receipt sent, waiting for confirmation
            </span>
          ) : (
            <span className="badge">Waiting for your transfer</span>
          )}
        </header>
        {bank ? (
          <div className="bank-card">
            <div className="bank-card-head">
              <Landmark size={18} aria-hidden /> Pay Kwaravend · {bank.bankName}
            </div>
            <dl>
              <div>
                <dt>Account number</dt>
                <dd>
                  <span className="mono bank-card-num">{bank.accountNumber}</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copy('num', bank.accountNumber)}>
                    <Copy size={14} aria-hidden /> {copied === 'num' ? 'Copied' : 'Copy'}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Account name</dt>
                <dd>{bank.accountName}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="mono">{formatNaira(open.amountKobo)}</dd>
              </div>
              <div>
                <dt>Narration (important)</dt>
                <dd>
                  <span className="mono">{open.reference}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy('ref', open.reference)}>
                    <Copy size={14} aria-hidden /> {copied === 'ref' ? 'Copied' : 'Copy'}
                  </button>
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="muted">Kwaravend hasn&apos;t added its bank details yet. Check back shortly.</p>
        )}
        <div className="plan-buy-upload">
          <label>
            {open.proofUrl ? 'Replace the receipt' : 'Upload the transfer receipt'}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn btn-primary" disabled={!file || busy === 'upload'} onClick={upload}>
            <Upload size={16} aria-hidden /> {busy === 'upload' ? 'Uploading…' : 'Send receipt'}
          </button>
          {open.proofUrl && (
            <a href={open.proofUrl} target="_blank" rel="noopener noreferrer" className="muted">
              View the receipt you sent
            </a>
          )}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Your plan switches on as soon as we confirm the money, usually the same day. You&apos;ll see it here.
        </p>
        {err && (
          <p role="alert" className="plan-err">
            {err}
          </p>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy === 'cancel'} style={{ justifySelf: 'start' }}>
          <X size={14} aria-hidden /> Cancel this purchase
        </button>
      </section>
    );
  }

  return (
    <section className="plan-choose" aria-label="Choose a plan">
      <div className="plan-months" role="radiogroup" aria-label="How many months?">
        {MONTHS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={months === m} className={months === m ? 'chip is-active' : 'chip'} onClick={() => setMonths(m)}>
            {m} month{m === 1 ? '' : 's'}
          </button>
        ))}
      </div>
      <div className="plan-grid">
        {plans.map((p) => (
          <div key={p.id} className="card plan-opt">
            <strong>{p.name}</strong>
            <span className="mono">
              {formatNaira(p.priceKobo * months)}
              <em> for {months} month{months === 1 ? '' : 's'}</em>
            </span>
            {p.current ? (
              <button type="button" className="btn btn-outline" disabled={!billingReady || busy !== null} onClick={() => choose(p.id)}>
                <CheckCircle2 size={16} aria-hidden /> Renew
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={!billingReady || busy !== null} onClick={() => choose(p.id)}>
                {busy === p.id ? 'Starting…' : `Choose ${p.name}`}
              </button>
            )}
          </div>
        ))}
      </div>
      {!billingReady && <p className="muted">Plan payments open as soon as Kwaravend adds its bank details.</p>}
      {err && (
        <p role="alert" className="plan-err">
          {err}
        </p>
      )}
    </section>
  );
}
