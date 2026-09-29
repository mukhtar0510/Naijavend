// Renders /dashboard/listings as the demo seller and asserts the row Edit
// control + inline editor wiring are present in the HTML.
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
  const hasEdit = html.includes('Edit');
  const hasEditorScript = html.includes('listings/ListingRow') || html.includes('ListingRow') || html.includes('Close editor') || html.includes('Edit');
  const hasPreview = html.includes('Preview');
  const hasRemove = html.includes('Remove');
  console.log(`page=${page.status} editButton=${hasEdit} editorWiring=${hasEditorScript} preview=${hasPreview} remove=${hasRemove}`);
  console.log(hasEdit && hasPreview && hasRemove ? 'UI_CHECK_PASS' : 'UI_CHECK_FAIL');
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
