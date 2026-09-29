'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { naira } from '@/lib/format';

const EMOJIS = ['🏪', '☔', '🎓', '🏠', '🚗', '🎉'];
const RATES = [
  { rate: 0.08, label: 'Flexible · 8% p.a.' },
  { rate: 0.12, label: 'Fixed · 12% p.a.' },
];

export default function SavingsPage() {
  const { state, saveTo, withdrawFrom, createPocket } = useWallet();
  const [activePocket, setActivePocket] = useState<string | null>(null);
  const [action, setAction] = useState<'save' | 'withdraw'>('save');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0]);
  const [newRate, setNewRate] = useState(RATES[0].rate);

  const totalSaved = state.pockets.reduce((s, p) => s + p.amountKobo, 0);

  function submit() {
    const kobo = Math.round((parseFloat(amount) || 0) * 100);
    if (!activePocket || kobo < 10000) return setError('Minimum is ₦100.');
    if (action === 'save' && kobo > state.balanceKobo) return setError('Not enough wallet balance.');
    if (action === 'withdraw' && kobo > (state.pockets.find((p) => p.id === activePocket)?.amountKobo ?? 0)) {
      return setError('That pocket does not hold that much.');
    }
    setError('');
    if (action === 'save') saveTo(activePocket, kobo);
    else withdrawFrom(activePocket, kobo);
    setAmount('');
    setActivePocket(null);
  }

  function create() {
    const kobo = Math.round((parseFloat(amount) || 0) * 100);
    if (newName.trim().length < 2) return setCreateError('Give the pocket a name.');
    if (kobo > state.balanceKobo) return setCreateError('Not enough wallet balance to fund it.');
    createPocket(newName.trim(), newEmoji, kobo, newRate);
    setNewName('');
    setAmount('');
    setCreating(false);
    setCreateError('');
  }

  return (
    <>
      <h2>Savings</h2>

      <div className="np-balance" style={{ padding: '18px 20px' }} aria-label="Total savings">
        <p className="np-balance-label">Total saved</p>
        <p className="np-balance-amount" style={{ fontSize: 30 }}>{naira(totalSaved)}</p>
        <p className="np-balance-sub">{state.pockets.length} pocket{state.pockets.length === 1 ? '' : 's'} · demo interest accrues monthly</p>
      </div>

      {state.pockets.map((p) => {
        const monthly = Math.round((p.amountKobo * p.rate) / 12);
        return (
          <div key={p.id} className="np-pocket">
            <div className="np-pocket-head">
              <span className="np-pocket-ico" aria-hidden>{p.emoji}</span>
              <span className="np-pocket-name">{p.name}</span>
              <span className="np-pocket-rate badge badge-blue">{Math.round(p.rate * 100)}% p.a.</span>
            </div>
            <p className="np-pocket-amt">{naira(p.amountKobo)}</p>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              ≈ {naira(monthly)} interest / month (demo)
            </p>
            <div className="np-pocket-foot">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setActivePocket(p.id); setAction('save'); setError(''); setAmount(''); }}>
                + Add
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setActivePocket(p.id); setAction('withdraw'); setError(''); setAmount(''); }}>
                Withdraw
              </button>
            </div>
            {activePocket === p.id && (
              <div style={{ marginTop: 12 }}>
                {error && <div className="alert alert-error" role="alert">{error}</div>}
                <input
                  className="np-amount-input"
                  type="number"
                  inputMode="decimal"
                  min={100}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label={`${action === 'save' ? 'Amount to save' : 'Amount to withdraw'} in ${p.name}`}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!amount}>
                    {action === 'save' ? 'Move to pocket' : 'Back to wallet'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setActivePocket(null); setError(''); setAmount(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {creating ? (
        <div className="card">
          <h3 style={{ fontSize: 16 }}>New savings pocket</h3>
          {createError && <div className="alert alert-error" role="alert">{createError}</div>}
          <div className="field">
            <label htmlFor="pname">Pocket name</label>
            <input id="pname" type="text" maxLength={30} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Shop rent" />
          </div>
          <div className="field">
            <span className="field label" aria-hidden />
            <div className="np-filters">
              {EMOJIS.map((e) => (
                <button key={e} type="button" className={`np-chip${newEmoji === e ? ' is-active' : ''}`} onClick={() => setNewEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Plan</label>
            <div className="np-filters">
              {RATES.map((r) => (
                <button key={r.rate} type="button" className={`np-chip${newRate === r.rate ? ' is-active' : ''}`} onClick={() => setNewRate(r.rate)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="pamt">Opening amount (optional)</label>
            <input id="pamt" type="number" inputMode="decimal" min={0} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={create}>Create pocket</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setCreateError(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-outline btn-block" onClick={() => setCreating(true)}>
          ＋ New pocket
        </button>
      )}

      <p className="np-demo-note">
        🐷 Demo savings: interest numbers are illustrative only — nothing accrues in real life and funds never leave this browser.
      </p>
    </>
  );
}
