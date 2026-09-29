// E2E: full order → pay happy path against prod.
// 1. create-order returns payToken  2. mock-pay accepts it, order goes paid
// 3. forged token on a fresh order is rejected  4. stock decremented exactly once.
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = 'https://naijacart-roan.vercel.app';
const SLUG = 'amaka-glow-studio';

async function main() {
  // Find an in-stock, orderable product listing. Plain REST — no SDK needed.
  const rest = async (path) => {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    return res.json();
  };
  const stores = await rest(`stores?slug=eq.${SLUG}&select=id`);
  if (!stores?.[0]) { console.log('STORE NOT FOUND'); process.exit(1); }
  const storeId = stores[0].id;
  const listings = await rest(`listings?store_id=eq.${storeId}&type=eq.product&stock=gt.2&select=id,title,price_kobo,stock&limit=1`);
  const pick = listings?.[0];
  if (!pick) { console.log('NO_ORDERABLE_LISTING'); process.exit(1); }
  console.log('LISTING', pick.id, `"${pick.title}"`, `stock=${pick.stock}`, `price=${pick.price_kobo}`);

  const stockBefore = pick.stock;

  // ORDER 1: happy path.
  let r = await fetch(`${BASE}/api/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG, items: [{ listingId: pick.id, quantity: 1 }], customerName: 'QA Payflow', customerPhone: '+2348011122233' }),
  });
  const o1 = await r.json();
  console.log('CREATE-ORDER ->', r.status, '| payToken present:', !!o1.payToken, '| total:', o1.totalKobo);
  if (!o1.payToken) { console.log('FAIL: no payToken'); process.exit(1); }

  r = await fetch(`${BASE}/api/mock-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: o1.orderId, payToken: o1.payToken }),
  });
  const p1 = await r.json();
  console.log('MOCK-PAY (real token) ->', r.status, p1.paid ? `paid, ref=${p1.reference}` : JSON.stringify(p1).slice(0, 120));

  // ORDER 2: forged token must be rejected and the order must stay pending.
  r = await fetch(`${BASE}/api/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG, items: [{ listingId: pick.id, quantity: 1 }], customerName: 'QA Payflow', customerPhone: '+2348011122233' }),
  });
  const o2 = await r.json();
  r = await fetch(`${BASE}/api/mock-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: o2.orderId, payToken: 'f'.repeat(64) }),
  });
  console.log('MOCK-PAY (forged) ->', r.status, '(expect 403)');
  const o2rows = await rest(`orders?id=eq.${o2.orderId}&select=status`);
  console.log('ORDER2 status ->', o2rows?.[0]?.status, '(expect pending)');

  // Stock decremented exactly twice (two 1-unit orders).
  const afterRows = await rest(`listings?id=eq.${pick.id}&select=stock`);
  const afterStock = afterRows?.[0]?.stock;
  console.log(`STOCK ${stockBefore} -> ${afterStock} (expect -2)`);
  const pass = p1.paid && r.status === 403 && o2rows?.[0]?.status === 'pending' && stockBefore - afterStock === 2;
  console.log(pass ? 'E2E PASS ✅' : 'E2E FAIL ❌');
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
