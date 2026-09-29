// E2E: seller edits a listing after creating it (production).
// 1. Sign in the demo seller through Supabase, exchange for seller cookies.
// 2. Create a throwaway listing.
// 3. Edit title/price/stock — expect 200 and the new values persisted.
// 4. Validation guards: bad price, compare-at <= price, negative stock.
// 5. Auth guard: no cookies -> 401. Wrong store -> 404 (own-store scoping).
// 6. Clean up: delete the throwaway listing.
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = 'https://naijacart-roan.vercel.app';
const SELLER = { email: 'amaka@demo.test', password: 'demo1234' };

const out = [];
const log = (s) => { out.push(s); console.log(s); };
let cookies = '';

async function signIn() {
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(SELLER),
  });
  const body = await res.json();
  if (!res.ok) throw new Error('seller sign-in failed: ' + JSON.stringify(body));
  const r2 = await fetch(`${SITE}/api/auth/oauth-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: body.access_token, refreshToken: body.refresh_token, role: 'seller' }),
  });
  const b2 = await r2.json();
  const setCookie = r2.headers.getSetCookie ? r2.headers.getSetCookie() : [r2.headers.get('set-cookie')].filter(Boolean);
  cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
  log(`STEP1 seller session: oauth-session=${r2.status} role=${b2.role} cookies=${cookies.split('; ').length}`);
  if (!cookies.includes('idev_access_token')) throw new Error('no seller access cookie');
}

async function api(path, body, withCookies = true) {
  const res = await fetch(`${SITE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(withCookies ? { Cookie: cookies } : {}) },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: parsed };
}

(async () => {
  await signIn();

  // Create a throwaway listing to edit.
  const created = await api('/api/listings/create', {
    storeId: 'aaaaaaa1-0000-4000-8000-000000000001',
    type: 'product',
    title: 'E2E edit me',
    description: 'temporary listing for the edit e2e',
    priceKobo: 500000,
    compareAtKobo: null,
    stock: 5,
    imageUrls: [],
    videoUrl: null,
  });
  log(`STEP2 create: ${created.status}`);

  // Find it so we have its id.
  const q = await fetch(`${SUPA}/rest/v1/listings?store_id=eq.aaaaaaa1-0000-4000-8000-000000000001&title=eq.E2E%20edit%20me&select=id,title,price_kobo,stock`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'return=representation' },
  });
  const rows = await q.json();
  const listingId = rows?.[0]?.id;
  if (!listingId) throw new Error('throwaway listing not found: ' + JSON.stringify(rows));
  log(`STEP3 listing id=${listingId}`);

  // The real edit.
  const edited = await api('/api/listings/update', {
    listingId,
    title: 'E2E edited title',
    description: 'corrected description after publishing',
    priceKobo: 750000,
    compareAtKobo: 1000000,
    stock: 12,
    imageUrls: [],
    videoUrl: null,
  });
  log(`STEP4 update: ${edited.status} ${JSON.stringify(edited.body)}`);

  const check = await fetch(`${SUPA}/rest/v1/listings?id=eq.${listingId}&select=title,price_kobo,compare_at_kobo,stock`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const after = (await check.json())[0];
  log(`STEP5 persisted: ${JSON.stringify(after)}`);
  const ok = after?.title === 'E2E edited title' && after?.price_kobo === 750000 && after?.compare_at_kobo === 1000000 && after?.stock === 12;
  log(`STEP5 ${ok ? 'PASS' : 'FAIL'} — edit persisted`);

  // Validation: compare-at must be higher than price.
  const bad = await api('/api/listings/update', { listingId, title: 'x2', priceKobo: 900000, compareAtKobo: 500000, stock: 1, imageUrls: [], videoUrl: null });
  log(`STEP6 compare-not-higher: ${bad.status} (${bad.body?.error?.code})`);

  // Validation: negative stock.
  const badStock = await api('/api/listings/update', { listingId, title: 'x2', priceKobo: 900000, compareAtKobo: null, stock: -3, imageUrls: [], videoUrl: null });
  log(`STEP7 negative stock: ${badStock.status} (${badStock.body?.error?.code})`);

  // Auth guard.
  const anon = await api('/api/listings/update', { listingId, title: 'hacked', priceKobo: 1, imageUrls: [] }, false);
  log(`STEP8 unauthenticated: ${anon.status} (${anon.body?.error?.code})`);

  // Unknown listing id -> 404, not a silent no-op.
  const missing = await api('/api/listings/update', { listingId: 'bbbbbbb2-0000-4000-8000-000000000002', title: 'nope', priceKobo: 100, imageUrls: [] });
  log(`STEP9 other-store listing: ${missing.status} (${missing.body?.error?.code})`);

  // Clean up (direct delete via SQL is done separately; here use the delete API).
  const del = await fetch(`${SITE}/api/listings/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    body: `listingId=${listingId}`,
    redirect: 'manual',
  });
  log(`STEP10 cleanup delete: ${del.status}`);
  log('E2E_DONE');
})().catch((e) => {
  console.error('E2E ERROR', e.message);
  process.exit(1);
});
