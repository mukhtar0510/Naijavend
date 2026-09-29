'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { NAIJA_STORES, storeById, type NaijaStore } from '@/lib/stores';
import { naira } from '@/lib/format';

type Stage = 'form' | 'confirm' | 'done';

export default function PayPage() {
  const { state, payStore } = useWallet();
  const [store, setStore] = useState<NaijaStore | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const kobo = Math.round((parseFloat(amount) || 0) * 100);
  const insufficient = kobo > state.balanceKobo;

  function startConfirm() {
    if (!store) return setError('Pick a store first.');
    if (kobo < 10000) return setError('Minimum payment is ₦100.');
    if (insufficient) return setError('Not enough balance — add money first.');
    setError('');
    setPin('');
    setStage('confirm');
  }

  function onPinKey(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) {
      if (next === state.pin) {
        payStore(store!.id, kobo, note);
        setTimeout(() => setStage('done'), 120);
      } else {
        setTimeout(() => {
          setError('Wrong PIN.');
          setPin('');
        }, 120);
      }
    }
  }

  if (stage === 'done' && store) {
    return (
      <div className="np-success-hero">
        <div className="np-success-ico" aria-hidden>✓</div>
        <h2>Payment sent</h2>
        <p className="muted">
          {naira(kobo)} to <strong>{store.name}</strong> — the store confirms it on their Naijavend dashboard (demo).
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
          <Link className="btn btn-primary" href="/transactions">
            View receipt
          </Link>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setStore(null);
              setAmount('');
              setNote('');
              setStage('form');
            }}
          >
            Pay again
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'confirm' && store) {
    return (
      <>
        <h2>Confirm payment</h2>
        <div className="card card-elevated" style={{ marginBottom: 16 }}>
          <div className="np-kv">
            <span className="np-kv-k">To</span>
            <span className="np-kv-v">{store.emoji} {store.name}</span>
          </div>
          <div className="np-kv">
            <span className="np-kv-k">Amount</span>
            <span className="np-kv-v mono">{naira(kobo)}</span>
          </div>
          {note && (
            <div className="np-kv">
              <span className="np-kv-k">Note</span>
              <span className="np-kv-v">{note}</span>
            </div>
          )}
          <div className="np-kv">
            <span className="np-kv-k">Channel</span>
            <span className="np-kv-v">NaijaPay wallet · demo</span>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontWeight: 600 }}>Enter PIN to approve</p>
        <div className="np-dots" style={{ justifyContent: 'center' }} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`np-dot${pin.length > i ? ' is-filled' : ''}`} />
          ))}
        </div>
        {error && <p className="np-lock-error" style={{ textAlign: 'center' }} role="alert">{error}</p>}
        <div className="np-pad" style={{ justifyContent: 'center' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="np-key" onClick={() => onPinKey(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="np-key is-muted" onClick={() => setStage('form')}>
            Cancel
          </button>
          <button type="button" className="np-key" onClick={() => onPinKey('0')}>
            0
          </button>
          <button type="button" className="np-key is-muted" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">
            ⌫
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>Pay a Naijavend store</h2>
      <p className="muted" style={{ fontSize: 14.5 }}>
        Pick the store you're paying on the marketplace — the money lands as a Naijavend payment (demo).
      </p>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="np-stores" role="radiogroup" aria-label="Choose store">
        {NAIJA_STORES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={store?.id === s.id}
            className={`np-store${store?.id === s.id ? ' is-active' : ''}`}
            onClick={() => setStore(s)}
          >
            <span className="np-store-logo" style={{ background: s.color }} aria-hidden>
              {s.name.charAt(0)}
            </span>
            <span>
              <span className="np-store-name">{s.name}</span>
              <br />
              <span className="np-store-cat">{s.emoji} {s.category}</span>
            </span>
            {store?.id === s.id && <span className="np-store-check" aria-hidden>✓</span>}
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="amt">Amount</label>
        <input
          id="amt"
          className="np-amount-input"
          type="number"
          inputMode="decimal"
          min={100}
          step="50"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {store && (
          <div className="np-filters" style={{ marginTop: 8 }}>
            {store.quickKobo.map((k) => (
              <button key={k} type="button" className={`np-chip${kobo === k ? ' is-active' : ''}`} onClick={() => setAmount(String(k / 100))}>
                {naira(k)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="note">Order note (optional)</label>
        <input
          id="note"
          type="text"
          maxLength={80}
          placeholder="e.g. Deposit for two wigs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="hint">The store sees this on the payment confirmation — same as a Naijavend checkout note.</p>
      </div>

      {insufficient && amount !== '' && (
        <div className="alert alert-error">Balance is {naira(state.balanceKobo)} — top up to cover this payment.</div>
      )}

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startConfirm} disabled={!store || !amount}>
        Continue → {kobo >= 10000 ? naira(kobo) : ''}
      </button>
      <p className="np-demo-note">
        💡 Demo flow: the store names here mirror the marketplace (like Amaka Glow Studio), but payments only move demo balance in this browser.
      </p>
    </>
  );
}
