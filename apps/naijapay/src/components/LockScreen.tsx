'use client';

import { useState } from 'react';
import { useSessionLock, useWallet } from '@/lib/wallet';

// Demo PIN gate. Default 1234, changeable in Profile. Nothing here is real
// security — the wallet is a demo and its data is local to this browser.
export function LockScreen() {
  const { state } = useWallet();
  const { unlock } = useSessionLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  function press(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) {
      if (next === state.pin) {
        setTimeout(unlock, 120);
      } else {
        setTimeout(() => {
          setShaking(true);
          setError('Wrong PIN — try again (demo: 1234).');
          setPin('');
          setTimeout(() => setShaking(false), 400);
        }, 120);
      }
    }
  }

  return (
    <div className="np-lock">
      <div className="np-lock-logo">
        Naija<span>Pay</span>
      </div>
      <p className="np-lock-sub">Enter your PIN to open your wallet</p>

      <div className={`np-dots${shaking ? ' np-shake' : ''}`} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`np-dot${pin.length > i ? ' is-filled' : ''}`} />
        ))}
      </div>
      <p className="np-lock-error" role="alert">{error}</p>

      <div className="np-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="np-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="np-key is-muted" onClick={() => setPin('')} aria-label="Clear">
          Clear
        </button>
        <button type="button" className="np-key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="np-key is-muted" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">
          ⌫
        </button>
      </div>

      <p className="np-demo-note" style={{ maxWidth: 300 }}>
        🔒 Demo wallet — default PIN is <strong>1234</strong>. Nothing here connects to a real bank or the live Naijavend.
      </p>
    </div>
  );
}
