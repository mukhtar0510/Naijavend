'use client';

// Email + password sign-in / sign-up / forgot password (buyers and sellers).
// Talks to /api/auth/password, which sets the same httpOnly session cookies
// as Google sign-in. Shown under the Google button with an "or" divider.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'reset';

export function EmailPasswordForm({ role }: { role: 'seller' | 'customer' }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, email, password: mode === 'reset' ? undefined : password, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Something went wrong. Try again.');
      if (mode === 'reset') {
        setInfo('If that email has an account, a reset link is on its way. Check your inbox and spam folder.');
      } else if (body.signedIn) {
        router.replace(body.next ?? (role === 'seller' ? '/dashboard' : '/account'));
        router.refresh();
      } else if (body.needsConfirmation) {
        setInfo('Account created. Open the confirmation link we emailed you, then sign in.');
        setMode('signin');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pw-form" onSubmit={submit} noValidate>
      <div className="pw-tabs" role="tablist" aria-label="Email sign-in">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'is-active' : ''}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
          >
            {m === 'signin' ? 'Sign in with email' : 'Create account'}
          </button>
        ))}
      </div>

      <label className="pw-field">
        <span>Email</span>
        <span className="pw-input">
          <Mail size={16} aria-hidden />
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
        </span>
      </label>

      {mode !== 'reset' && (
        <label className="pw-field">
          <span>Password</span>
          <span className="pw-input">
            <Lock size={16} aria-hidden />
            <input
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            />
            <button type="button" className="pw-eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>
              {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </span>
        </label>
      )}

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {info && <div className="alert alert-success" role="status">{info}</div>}

      <button type="submit" className="btn btn-primary btn-block" aria-busy={busy || undefined} disabled={busy}>
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my account' : 'Send reset link'}
      </button>

      <div className="pw-links">
        {mode === 'reset' ? (
          <button type="button" className="btn-link btn" onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        ) : (
          <button type="button" className="btn-link btn" onClick={() => setMode('reset')}>
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
}
