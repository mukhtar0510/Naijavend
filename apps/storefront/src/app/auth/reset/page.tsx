'use client';

// Password reset landing page. The reset email links here with a one-time
// recovery session in the URL (hash tokens, or a ?code for PKCE). The buyer or
// seller chooses a new password; we then hand the session to the server so the
// usual httpOnly cookies are set, exactly like Google sign-in.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Lock } from 'lucide-react';
import { purgeSupabaseBrowserState } from '@/lib/oauth-cleanup';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') ?? '/account' : '/account';

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError('Sign-in is not configured.');
      return;
    }
    const client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } });
    setSb(client);
    void (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = new URLSearchParams(window.location.search).get('code');
      const access = hash.get('access_token');
      const refresh = hash.get('refresh_token');
      const { error: e } = access && refresh
        ? await client.auth.setSession({ access_token: access, refresh_token: refresh })
        : code
          ? await client.auth.exchangeCodeForSession(code)
          : { error: new Error('missing') };
      if (e) setError('This reset link has expired or was already used. Ask for a new one from the sign-in page.');
      else setReady(true);
      // Remove tokens from the address bar.
      window.history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]code=[^&]*/, ''));
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    if (password.length < 8 || password.length > 72) {
      setError('Use a password of 8 to 72 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: upErr } = await sb.auth.updateUser({ password });
      if (upErr) throw new Error('Could not save the new password. Ask for a new reset link.');
      const { data } = await sb.auth.getSession();
      if (!data.session) throw new Error('Your reset session ended. Ask for a new link.');
      const res = await fetch('/api/auth/oauth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          role: next.startsWith('/dashboard') ? 'seller' : 'customer',
        }),
      });
      if (!res.ok) throw new Error('Password saved, but we could not sign you in. Sign in with your new password.');
      purgeSupabaseBrowserState();
      router.replace(next.startsWith('/') ? next : '/account');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="order-page" style={{ maxWidth: 460 }}>
      <section className="order-head">
        <h1>Choose a new password</h1>
        <p className="muted" style={{ margin: 0 }}>Use at least 8 characters. You&apos;ll be signed in straight after.</p>
      </section>
      <form className="order-card pw-form" onSubmit={save}>
        <label className="pw-field">
          <span>New password</span>
          <span className="pw-input">
            <Lock size={16} aria-hidden />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              required
              disabled={!ready}
            />
          </span>
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!ready || busy} aria-busy={busy || undefined}>
          Save password and sign in
        </button>
        <Link href={next.startsWith('/dashboard') ? '/dashboard/signin' : '/account/signin'} className="muted" style={{ fontSize: 13.5 }}>
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
