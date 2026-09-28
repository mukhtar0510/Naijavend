// E2E: seller with EXPIRED access cookie + valid refresh cookie visits /dashboard.
// Before the fix this 500'd (cookie write during RSC render). Expect: 307 bounce
// through /api/auth/session-refresh, fresh cookies, final 200 dashboard HTML.
const fs = require('fs');

const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = 'https://naijacart-roan.vercel.app';

async function main() {
  // STEP1: sign in as the demo seller to obtain a real session.
  const r1 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ email: 'amaka@demo.test', password: 'demo1234' }),
  });
  const j1 = await r1.json();
  if (!j1.access_token) {
    console.log('STEP1 FAIL', r1.status, JSON.stringify(j1).slice(0, 200));
    process.exit(1);
  }
  console.log('STEP1 ok: got session (refresh token present:', !!j1.refresh_token + ')');

  // STEP2: hit /dashboard with ONLY the refresh cookie — no access cookie.
  // This is the exact path that 500'd before the fix.
  const r2 = await fetch(`${BASE}/dashboard`, {
    redirect: 'manual',
    headers: {
      Cookie: `idev_refresh_token=${j1.refresh_token}`,
      'User-Agent': 'Mozilla/5.0 (e2e-test)',
    },
  });
  console.log('STEP2 /dashboard with refresh-only cookie ->', r2.status, r2.headers.get('location') || '');

  if (r2.status === 307 && (r2.headers.get('location') || '').includes('/api/auth/session-refresh')) {
    // STEP3: follow the bounce — route handler refreshes + sets cookies.
    const bounceUrl = new URL(r2.headers.get('location'), BASE).toString();
    const r3 = await fetch(bounceUrl, { redirect: 'manual', headers: { Cookie: `idev_refresh_token=${j1.refresh_token}` } });
    const setCookies = r3.headers.getSetCookie ? r3.headers.getSetCookie() : [r3.headers.get('set-cookie')].filter(Boolean);
    const loc = r3.headers.get('location') || '';
    console.log('STEP3 session-refresh ->', r3.status, loc, '| set-cookie count:', setCookies.length);
    if (r3.status !== 307 || !loc.endsWith('/dashboard')) {
      console.log('STEP3 UNEXPECTED');
      process.exit(1);
    }
    // STEP4: rebuild cookie jar from rotated cookies and load /dashboard for real.
    const jar = setCookies.map((c) => c.split(';')[0]).join('; ');
    const r4 = await fetch(new URL(loc, BASE), { redirect: 'manual', headers: { Cookie: jar } });
    const html = await r4.text();
    console.log('STEP4 /dashboard with fresh cookies ->', r4.status, '| html length:', html.length, '| has dash-shell:', html.includes('dash-shell'));
    console.log(r4.status === 200 && html.includes('dash-shell') ? 'E2E PASS ✅' : 'E2E FAIL ❌');
  } else if (r2.status === 200) {
    console.log('Unexpected direct 200 without refresh (check).');
  } else {
    console.log(r2.status === 500 ? 'STEP2 500 — BUG STILL PRESENT ❌' : `STEP2 unexpected status ${r2.status}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
