'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { purgeSupabaseBrowserState } from '@/lib/oauth-cleanup';

// OAuth landing page: Google redirects here with ?code=... The browser client
// that started the flow holds the PKCE verifier, so the exchange happens
// here; the tokens are then POSTed to /api/auth/oauth-session which verifies
// them against Supabase and sets the role's httpOnly cookies.
//
// Role routing rule: only /dashboard* is seller; everything else is customer.
// The `next` param can arrive double-encoded (Supabase's auth callback
// re-encodes the query string it forwards, so ?next=%2Fdashboard can land as
// %252Fdashboard), so we decode repeatedly before deciding the role — a
// literal "%2Fdashboard" string must NOT be mistaken for a customer link.
export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const code = search.get('code');
    const next = decodeNext(search.get('next'));
    const role = next.startsWith('/dashboard') ? 'seller' : 'customer';

    if (!code) {
      setError('No sign-in code came back from Google. Please try again.');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('missing_config');
        // Must match the flow that started OAuth (pkce) so the stored code
        // verifier is found; detectSessionInUrl is off so only our explicit
        // exchangeCodeForSession runs (no auto-detect race).
        const sb = createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } });
        const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) throw new Error('exchange_failed');

        const res = await fetch('/api/auth/oauth-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            role,
          }),
        });
        if (!res.ok) throw new Error('session_save_failed');

        // Success: drop any stale browser-side session remnants — the real
        // session now lives in the httpOnly cookies set by oauth-session.
        purgeSupabaseBrowserState();

        router.replace(next);
        router.refresh();
      } catch {
        if (!cancelled) {
          // A failed attempt leaves an unusable code/verifier pair — purge so
          // the next try starts clean instead of replaying the stale one.
          purgeSupabaseBrowserState();
          setError('We could not finish signing you in with Google. Please try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const backHref = typeof window !== 'undefined' && decodeNext(new URLSearchParams(window.location.search).get('next')).startsWith('/dashboard') ? '/dashboard/signin' : '/account/signin';

  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      {error ? (
        <div className="card" style={{ maxWidth: 460, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
          <h1 style={{ fontSize: 20, marginTop: 0 }}>Sign-in didn&apos;t finish</h1>
          <p className="muted" style={{ fontSize: 14.5 }}>{error}</p>
          <Link className="btn btn-primary" href={backHref} style={{ marginTop: 12 }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div className="skel" style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px' }} />
          <p className="muted" style={{ margin: 0 }}>Finishing Google sign-in…</p>
        </div>
      )}
    </main>
  );
}

/**
 * Normalise the `next` param through every layer of encoding the redirect
 * chain may have added (%252Faccount → %2Faccount → /account), then validate
 * it: it must be a local, absolute path (no //open-redirect, no scheme).
 */
function decodeNext(raw: string | null): string {
  let candidate = raw ?? '/account';
  for (let i = 0; i < 3; i++) {
    if (!candidate.includes('%')) break;
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      break;
    }
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/account';
  return candidate;
}
