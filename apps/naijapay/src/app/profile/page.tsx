'use client';

import { useState } from 'react';
import { useWallet, useSessionLock } from '@/lib/wallet';
import { ThemeButton } from '@/components/AppChrome';

export default function ProfilePage() {
  const { state, setPin, resetWallet } = useWallet();
  const { lock } = useSessionLock();
  const [stage, setStage] = useState<'idle' | 'current' | 'new'>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function pressCurrent(d: string) {
    if (d === '__del__') {
      setCurrent((v) => v.slice(0, -1));
      return;
    }
    if (current.length >= 4) return;
    const c = current + d;
    setCurrent(c);
    setError('');
    if (c.length === 4) {
      if (c === state.pin) {
        setStage('new');
        setCurrent('');
      } else {
        setError('Current PIN is wrong.');
        setCurrent('');
      }
    }
  }

  function pressNext(d: string) {
    if (d === '__del__') {
      setNext((v) => v.slice(0, -1));
      return;
    }
    if (next.length >= 4) return;
    const n = next + d;
    setNext(n);
    setError('');
    if (n.length === 4) {
      setPin(n);
      setOk('PIN updated.');
      setStage('idle');
      setNext('');
    }
  }

  function pad(onKey: (d: string) => void, value: string) {
    return (
      <>
        <div className="np-dots" style={{ justifyContent: 'center' }} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`np-dot${value.length > i ? ' is-filled' : ''}`} />
          ))}
        </div>
        <div className="np-pad" style={{ justifyContent: 'center' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="np-key" onClick={() => onKey(d)}>
              {d}
            </button>
          ))}
          <span />
          <button type="button" className="np-key" onClick={() => onKey('0')}>
            0
          </button>
          <button type="button" className="np-key is-muted" onClick={() => onKey('__del__')} aria-label="Delete">
            ⌫
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>Profile &amp; security</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="np-kv">
          <span className="np-kv-k">Wallet</span>
          <span className="np-kv-v">NaijaPay · demo user</span>
        </div>
        <div className="np-kv">
          <span className="np-kv-k">Pays on</span>
          <span className="np-kv-v">Naijavend marketplace</span>
        </div>
        <div className="np-toggle">
          <span>Dark mode</span>
          <ThemeButton />
        </div>
      </div>

      {ok && <div className="alert alert-success" role="status">{ok}</div>}

      {stage === 'idle' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="np-toggle">
            <span>PIN</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setStage('current'); setOk(''); }}>
              Change PIN
            </button>
          </div>
          <div className="np-toggle">
            <span>Lock wallet now</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={lock}>
              Lock
            </button>
          </div>
        </div>
      )}

      {stage === 'current' && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontWeight: 600 }}>Enter current PIN</p>
          {error && <p className="np-lock-error" role="alert" style={{ marginTop: 0 }}>{error}</p>}
          {pad(pressCurrent, current)}
        </div>
      )}

      {stage === 'new' && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontWeight: 600 }}>Choose a new 4-digit PIN</p>
          {pad(pressNext, next)}
        </div>
      )}

      <button
        type="button"
        className="btn btn-danger btn-block"
        onClick={() => {
          if (confirm('Reset the demo wallet to its seeded state? This clears your local history.')) {
            resetWallet();
            setOk('Wallet reset to demo seed.');
          }
        }}
      >
        Reset demo wallet
      </button>

      <p className="np-demo-note">
        🧪 This is a standalone demo app inspired by wallet UX, styled to match Naijavend. It holds no real money, no real
        store connections, and stores data only in this browser's localStorage.
      </p>
    </>
  );
}
