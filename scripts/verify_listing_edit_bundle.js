// Confirms the production client bundle for the listings page carries the
// stock fix: money fields go through the /100 kobo helper, stock does not.
// The chunk URL is discovered from the live page rather than hardcoded, since
// the build hash changes every deploy.
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = 'https://naijacart-roan.vercel.app';

(async () => {
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
  const cookies = (s.headers.getSetCookie ? s.headers.getSetCookie() : [s.headers.get('set-cookie')].filter(Boolean))
    .map((c) => c.split(';')[0])
    .join('; ');

  const page = await fetch(`${SITE}/dashboard/listings`, { headers: { Cookie: cookies } });
  const html = await page.text();
  const srcs = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+listings[^"]*)"/g)].map((m) => m[1]);
  const unique = [...new Set(srcs)];
  console.log(`page=${page.status} chunks=${unique.length}`);

  let ok = false;
  for (const src of unique) {
    const res = await fetch(`${SITE}${src}`);
    const text = await res.text();
    const koboHelper = /null==[a-zA-Z]?\?"":String\([a-zA-Z]\/100\)/.test(text);
    const stockWiring = /useState\)\([a-zA-Z]\(null==[a-zA-Z]?\?void 0:[a-zA-Z]+\.stock\)/.test(text);
    const stockDivided = /useState\)\([a-zA-Z]\(null==[a-zA-Z]?\?void 0:[a-zA-Z]+\.stock\)\),[^;]{0,80}\/100/.test(text);
    console.log(`  ${src} status=${res.status} moneyHelper=${koboHelper} stockWiring=${stockWiring} stockDivided=${stockDivided}`);
    if (koboHelper && stockWiring && !stockDivided) ok = true;
  }
  console.log(ok ? 'BUNDLE_CHECK_PASS — stock no longer divided by 100 in production' : 'BUNDLE_CHECK_FAIL');
  process.exit(ok ? 0 : 1);
})();
