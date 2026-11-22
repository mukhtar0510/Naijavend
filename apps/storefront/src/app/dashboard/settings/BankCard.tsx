'use client';

// Seller bank details for buyers who choose "Bank transfer" at checkout.
// Private: buyers only see them on their own order page.

import { useState } from 'react';
import { Landmark } from 'lucide-react';

export function BankDetailsCard({
  initial,
}: {
  initial: { bankName: string; accountName: string; accountNumber: string } | null;
}) {
  const [bankName, setBankName] = useState(initial?.bankName ?? '');
  const [accountName, setAccountName] = useState(initial?.accountName ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/dashboard/bank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bankName, accountName, accountNumber }),
      });
      const body = (await res.json()) as { error?: { message?: string } };
      setMsg(res.ok ? { ok: true, text: 'Saved. Buyers who pay by transfer now see these details on their order.' } : { ok: false, text: body.error?.message ?? 'Could not save.' });
    } catch {
      setMsg({ ok: false, text: 'Network problem. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={save} style={{ display: 'grid', gap: 10, padding: 16 }}>
      <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Landmark size={17} aria-hidden /> Bank details for transfers
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Buyers who choose bank transfer see these on their own order page, then upload a receipt. You confirm the money
        in Orders. Kwaravend never holds money.
      </p>
      <label style={{ display: 'grid', gap: 4, fontSize: 13.5, fontWeight: 600 }}>
        Bank
        <input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. GTBank, Opay, Moniepoint" />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 13.5, fontWeight: 600 }}>
        Account name
        <input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} autoComplete="off" />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 13.5, fontWeight: 600 }}>
        Account number (10 digits)
        <input
          className="input"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
          inputMode="numeric"
          autoComplete="off"
        />
      </label>
      {msg && (
        <p role="status" style={{ margin: 0, fontSize: 13, color: msg.ok ? 'var(--green)' : 'var(--danger)' }}>
          {msg.text}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>
        {busy ? 'Saving…' : 'Save bank details'}
      </button>
    </form>
  );
}
