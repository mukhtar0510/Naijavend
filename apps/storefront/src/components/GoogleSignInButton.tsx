'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { purgeSupabaseBrowserState } from '@/lib/oauth-cleanup';

// "Continue with Google" — starts Supabase's Google OAuth (PKCE). On success
// the browser redirects to Google and lands back on /auth/callback. If the
// Google provider isn't configured yet, the error is surfaced politely.
export function GoogleSignInButton({ next, label }: { next: string; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      // Remove any stale implicit-flow session/verifier from earlier attempts
      // so the PKCE flow starts clean.
      purgeSupabaseBrowserState();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('missing_config');
      // flowType pkce is REQUIRED: the library default is 'implicit', which
      // returns tokens in a URL fragment instead of ?code= — and /auth/callback
      // exchanges ?code= (PKCE) to set the httpOnly cookies.
      const sb = createClient(url, key, { auth: { flowType: 'pkce' } });
      const { error: oauthError } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) {
        setError(
          'Google sign-in is not available right now. Please try again in a moment.'
        );
        setBusy(false);
      }
      // On success the browser navigates away to Google — no further action.
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-google" onClick={signIn} disabled={busy}>
        <GoogleG />
        {busy ? 'Opening Google…' : (label ?? 'Continue with Google')}
      </button>
      {error && (
        <p className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.4 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.4-5.5l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-3.9-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
