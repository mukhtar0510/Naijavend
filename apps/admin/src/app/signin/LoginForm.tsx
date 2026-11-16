'use client';

import { useState } from 'react';

/** Email + password form → POST /api/auth/signin → cookie set → reload to /. */
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        window.location.href = '/';
        return;
      }
      setError(body?.error?.message ?? 'Sign-in failed. Check your credentials.');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="signin-admin-form">
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          placeholder="you@naijavend.com"
        />
      </label>
      <label>
        Password
        <span style={{ position: 'relative', display: 'block' }}>
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            style={{ width: '100%', paddingRight: 62 }}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px 7px',
              border: 0,
              borderRadius: 6,
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: 0.7,
            }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in to Control'}
      </button>
    </form>
  );
}
