export const metadata = {
  title: 'Cookies Policy',
  description: 'The cookies and local storage Naijavend uses, and why.',
};

const COOKIES: Array<{ name: string; type: string; purpose: string }> = [
  { name: 'idev_access_token / idev_refresh_token', type: 'Essential (sellers)', purpose: 'Keeps you signed in to your seller dashboard. http-only, signed session cookies.' },
  { name: 'idev_customer_token / idev_customer_refresh_token', type: 'Essential (customers)', purpose: 'Keeps you signed in as a customer so you can order, book, chat and rate. http-only.' },
  { name: 'vnd-cookie-consent', type: 'Essential', purpose: 'Remembers whether you answered the cookie banner so we stop asking.' },
  { name: 'vnd-view-<storeId>', type: 'Local storage (analytics)', purpose: 'Session-only flag that de-duplicates store visits so one browsing session counts once. Cleared when you close the tab.' },
  { name: 'sf-theme', type: 'Local storage (preferences)', purpose: 'Remembers your light/dark theme choice.' },
  { name: 'sf-loc', type: 'Local storage (location)', purpose: 'Remembers the location or base area you chose for the map and distance features. Your precise location never leaves your browser.' },
  { name: 'sf-saved', type: 'Local storage (preferences)', purpose: 'Remembers which stores you hearted, so they appear in My account.' },
];

export default function CookiesPage() {
  return (
    <div className="card" style={{ padding: 28 }}>
      <h1>Cookies Policy</h1>
      <p className="muted">Last updated: 20 September 2026</p>
      <p style={{ fontSize: 15 }}>
        Naijavend uses a very small number of cookies and browser storage entries. We do not use advertising or
        third-party tracking cookies, and we never sell browsing data.
      </p>

      <h2 style={{ fontSize: 18 }}>What we set</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {COOKIES.map((c) => (
          <div key={c.name} className="card" style={{ padding: 14 }}>
            <strong className="mono" style={{ fontSize: 13.5 }}>{c.name}</strong>
            <p className="muted" style={{ margin: '4px 0 2px', fontSize: 13 }}>{c.type}</p>
            <p style={{ margin: 0, fontSize: 14.5 }}>{c.purpose}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Managing cookies</h2>
      <p style={{ fontSize: 15 }}>
        You can clear or block cookies in your browser settings at any time. Blocking the essential session cookies
        means you will not be able to sign in, but browsing stores still works. The analytics flag lives in session
        storage and disappears when you close the tab — it identifies nobody.
      </p>
      <p style={{ fontSize: 15 }}>
        See the <a href="/legal/privacy">Privacy Policy</a> for how personal data (separate from these cookies) is handled.
      </p>
    </div>
  );
}
