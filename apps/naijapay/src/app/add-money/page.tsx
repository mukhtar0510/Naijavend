'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/wallet';
import { naira } from '@/lib/format';

const METHODS = [
  { id: 'card', label: 'Debit card', ico: '💳', hint: 'Visa / Mastercard / Verve' },
  { id: 'transfer', label: 'Bank transfer', ico: '🏦', hint: 'One-time account number' },
  { id: 'ussd', label: 'USSD', ico: '📞', hint: '*737*NaijaPay demo#' },
];

const QUICK = [200000, 500000, 1000000, 2500000]; // ₦2k / ₦5k / ₦10k / ₦25k

export default function AddMoneyPage() {
  const { topUp } = useWallet();
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');

  const kobo = Math.round((parseFloat(amount) || 0) * 100);

  function submit() {
    if (kobo < 10000) return setError('Minimum top-up is ₦100.');
    setError('');
    topUp(kobo, method.label);
    setDone(kobo);
  }

  if (done !== null) {
    return (
      <div className="np-success-hero">
        <div className="np-success-ico" aria-hidden>✓</div>
        <h2>Wallet funded</h2>
        <p className="muted">
          {naira(done)} added via {method.label.toLowerCase()} — instantly, because this is a demo.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
          <Link className="btn btn-primary" href="/pay">
            Pay a store
          </Link>
          <button type="button" className="btn btn-outline" onClick={() => { setDone(null); setAmount(''); }}>
            Top up more
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h2>Add money</h2>
      <p className="muted" style={{ fontSize: 14.5 }}>Fund your wallet to pay Naijavend stores instantly.</p>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="field">
        <span className="field label" aria-hidden />
        <div className="np-stores" role="radiogroup" aria-label="Funding method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method.id === m.id}
              className={`np-store${method.id === m.id ? ' is-active' : ''}`}
              onClick={() => setMethod(m)}
            >
              <span className="np-store-logo" style={{ background: 'var(--blue)' }} aria-hidden>
                {m.ico}
              </span>
              <span>
                <span className="np-store-name">{m.label}</span>
                <br />
                <span className="np-store-cat">{m.hint}</span>
              </span>
              {method.id === m.id && <span className="np-store-check" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="amt">Amount</label>
        <input
          id="amt"
          className="np-amount-input"
          type="number"
          inputMode="decimal"
          min={100}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="np-filters" style={{ marginTop: 8 }}>
          {QUICK.map((k) => (
            <button key={k} type="button" className={`np-chip${kobo === k ? ' is-active' : ''}`} onClick={() => setAmount(String(k / 100))}>
              {naira(k)}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={!amount}>
        Fund wallet {kobo >= 10000 ? `· ${naira(kobo)}` : ''}
      </button>
      <p className="np-demo-note">
        🧪 Demo top-up: no card is charged, no account exists — the credit lands in this browser's wallet instantly.
      </p>
    </>
  );
}
