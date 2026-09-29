// Renders /dashboard/analytics as the demo seller and asserts the traffic
// source list shows grouped labels (Home page / Search / Link / named apps)
// and never a raw host such as "localhost:3000" or a bare deploy domain.
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = 'https://naijacart-roan.vercel.app';

const ALLOWED = new Set([
  'Home page', 'Search', 'Link', 'Direct / typed',
  'Shared on WhatsApp', 'Shared on X (Twitter)', 'Shared on Facebook',
  'Shared on Telegram', 'Shared on the share menu',
  'WhatsApp', 'X (Twitter)', 'Facebook', 'Instagram', 'TikTok', 'YouTube',
  'Telegram', 'LinkedIn', 'Pinterest', 'Snapchat', 'Reddit',
]);

async function sellerCookies() {
  const t = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amaka@demo.test', password: 'demo1234' }),
  });
  const tok = await t.json();
  const s = await fetch(`${SITE}/api/auth/oauth-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: tok.access_token, refreshToken: tok.refresh_token, role: 'seller' }),
  });
  return (s.headers.getSetCookie ? s.headers.getSetCookie() : [s.headers.get('set-cookie')].filter(Boolean))
    .map((c) => c.split(';')[0])
    .join('; ');
}

(async () => {
  const cookies = await sellerCookies();
  const page = await fetch(`${SITE}/dashboard/analytics`, { headers: { Cookie: cookies } });
  const html = await page.text();
  console.log(`page=${page.status} bytes=${html.length}`);

  const section = html.split('Where visitors come from')[1] ?? '';

  // The referrer list is a client component, so its props arrive in the
  // streamed RSC payload — JSON nested inside JSON, with several levels of
  // backslash escaping. Collapse the escaping, then read label/count pairs.
  // (The daily chart uses "visits", so requiring "count" keeps us on the
  // referrer rows only.)
  let s = section;
  for (let i = 0; i < 4; i++) s = s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const pairs = [...s.matchAll(/"label":"([^"]+)","count":(\d+)/g)];
  const rows = pairs.map((m) => m[1]);
  console.log('rows:', pairs.map((m) => `${m[1]} (${m[2]})`).join(' | ') || '(none)');

  // Labels the demo store's real traffic produces. "Link" only appears when
  // external non-social traffic exists, so it is allowed but not required.
  const wants = ['Direct / typed', 'Search', 'Home page'];
  const forbid = ['localhost', '127.0.0.1', 'naijacart-roan.vercel.app', 'example.org', '192.168', 'google.com', 'someblog'];
  const missing = wants.filter((w) => !rows.includes(w));
  const leaked = forbid.filter((f) => section.includes(f));
  const unknown = rows.filter((r) => !ALLOWED.has(r));

  console.log('missing expected:', missing.join(',') || 'none');
  console.log('leaked raw hosts:', leaked.join(',') || 'none');
  console.log('unexpected labels:', unknown.join(',') || 'none');

  const ok = rows.length > 0 && missing.length === 0 && leaked.length === 0 && unknown.length === 0;
  console.log(ok ? 'ANALYTICS_SOURCES_PASS' : 'ANALYTICS_SOURCES_FAIL');
  process.exit(ok ? 0 : 1);
})();
