import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { InAppBrowserWarning } from '@/components/InAppBrowserWarning';
import { RefCapture } from '@/components/RefCapture';
import { BackToMarket } from '@/components/BackToMarket';

import Link from 'next/link';

const POINTS = [
  { ico: '🧾', text: 'Track all your orders and service bookings in one place.' },
  { ico: '⭐', text: 'Rate the stores you buy from — real reviews only.' },
  { ico: '💬', text: 'Chat directly with sellers about any product.' },
  { ico: '🔥', text: 'Discover trending products from trusted local businesses.' },
];

/** Only allow local, absolute paths — never `//evil.com`, `\\evil.com` or a scheme. */
function safeNext(raw: string | undefined): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  return '/account';
}

// Google-only auth: one button covers sign-in and sign-up. Supabase creates
// the auth user on first sign-in and a DB trigger seeds the customer profile.
// Deep links like /account/signin?next=/admin are honoured so the user returns
// to the page that asked them to sign in.
export default async function CustomerSignInPage({
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
          <h2>Shop local with total confidence.</h2>
          <p className="auth-tagline">Every store is a real Nigerian business with a real location and verified reviews.</p>
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
          <h1>Welcome to Naijavend</h1>
          <p className="auth-sub">
            One tap and you&apos;re in — track orders, bookings and your reviews.
          </p>

          <RefCapture />
          <InAppBrowserWarning />
          <GoogleSignInButton next={next} />

          <div className="auth-divider-or">or</div>
          <p className="auth-switch" style={{ marginTop: 0 }}>
            New here? Google creates your account automatically — no password to remember.
          </p>

          <div className="auth-trust">
            <span>🔐 Secure by Google</span>
            <span>🚫 No spam, ever</span>
            <span>⚡ Takes 5 seconds</span>
          </div>

          <p className="auth-switch">
            Own a business? <Link href="/dashboard/signin">Seller sign in</Link>
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
