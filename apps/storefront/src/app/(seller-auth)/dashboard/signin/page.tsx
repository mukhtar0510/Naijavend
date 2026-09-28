import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { InAppBrowserWarning } from '@/components/InAppBrowserWarning';
import { BackToMarket } from '@/components/BackToMarket';

import Link from 'next/link';

const POINTS = [
  { ico: '🏪', text: 'Your own store website at /s/your-name — styled your way.' },
  { ico: '🤖', text: 'AI drafts your store name, copy and theme in seconds.' },
  { ico: '💬', text: 'Orders, bookings and chat in one dashboard.' },
  { ico: '📈', text: 'See views, shares and sales in your analytics.' },
];

/** Only allow local, absolute paths under /dashboard — never an open redirect.
 * Backslash variants (\\evil.com) are treated as protocol-relative by some
 * browsers, so they're rejected along with `//`. */
function safeNext(raw: string | undefined): string {
  if (raw && raw.startsWith('/dashboard') && !raw.startsWith('/dashboard//') && !raw.includes('\\')) return raw;
  return '/dashboard';
}

// Google-only seller auth: one button covers sign-in and sign-up. After the
// OAuth hand-off the seller lands on /dashboard (or their deep-linked
// dashboard page) and onboards their store there.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = safeNext(searchParams.next);

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-blob ab1" />
        <div className="auth-blob ab2" />
        <Link href="/" className="auth-aside-brand">
          Naija<span>vend</span>
        </Link>
        <div style={{ position: 'relative' }}>
          <h2>Sell to Nigeria from your own corner of the web.</h2>
          <p className="auth-tagline">Real businesses, real locations, verified reviews — your store site is minutes away.</p>
        </div>
        <ul className="auth-points">
          {POINTS.map((p) => (
            <li key={p.text}>
              <span className="pt-ico" aria-hidden>{p.ico}</span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>

      <main className="auth-panel">
        <div className="card auth-card google-only">
          <h1>Seller sign in</h1>
          <p className="auth-sub">
            Your store, orders and analytics — one Google account, zero passwords.
          </p>

          <InAppBrowserWarning />
          <GoogleSignInButton next={next} label="Continue with Google" />

          <div className="auth-divider-or">or</div>
          <p className="auth-switch" style={{ marginTop: 0 }}>
            First time? Google creates your seller account automatically.
          </p>

          <div className="auth-trust">
            <span>🏪 Free to start</span>
            <span>🔐 Secure by Google</span>
            <span>⚡ 5-second setup</span>
          </div>

          <p className="auth-switch">
            Looking to shop instead? <Link href="/account/signin">Customer sign in</Link>
          </p>
          <p className="auth-switch">
            By continuing you agree to our <Link href="/legal/terms">Terms</Link> and{' '}
            <Link href="/legal/privacy">Privacy Policy</Link>.
          </p>
          <p className="auth-back muted">
            <Link href="/">← Back to marketplace</Link>
          </p>
        </div>
      </main>
      <BackToMarket label="Naijavend" />
    </div>
  );
}
