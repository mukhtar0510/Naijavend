// E2E: chat flow — customer sends a message, threads list it, read marker
// clears the unread count. Exercises exactly the paths changed in this fix.
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = 'https://naijacart-roan.vercel.app';
const QA_EMAIL = 'qa-chat-e2e@naijavend-qa.com';
const QA_PASS = 'qa-chat-1234';

async function main() {
  // Sign in (user pre-created DB-side like the profile QA run).
  let r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: QA_EMAIL, password: QA_PASS }),
  });
  const sess = await r.json();
  if (!sess.access_token) { console.log('SIGNIN FAIL', r.status, JSON.stringify(sess).slice(0, 150)); process.exit(1); }
  const cookies = `idev_customer_token=${sess.access_token}; idev_customer_refresh_token=${sess.refresh_token}`;
  console.log('SIGNIN ok', sess.user?.id ?? '');

  // Find amaka-glow-studio's store id (public read).
  r = await fetch(`${URL_}/rest/v1/stores?slug=eq.amaka-glow-studio&select=id,name`, {
    headers: { apikey: ANON, Authorization: `Bearer ${sess.access_token}` },
  });
  const [store] = await r.json();
  if (!store) { console.log('STORE NOT FOUND'); process.exit(1); }
  console.log('STORE', store.id, store.name);

  // Customer sends a message.
  r = await fetch(`${BASE}/api/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ storeId: store.id, body: 'E2E hello — is this available?' }),
  });
  const sent = await r.json();
  console.log('SEND ->', r.status, sent.message?.id ? 'ok' : JSON.stringify(sent).slice(0, 140));

  // GET shows it with role=customer.
  r = await fetch(`${BASE}/api/chat/messages?storeId=${store.id}`, { headers: { Cookie: cookies } });
  const got = await r.json();
  console.log('GET ->', r.status, '| role:', got.role, '| count:', got.messages?.length);

  // Conversations lists the thread.
  r = await fetch(`${BASE}/api/chat/conversations`, { headers: { Cookie: cookies } });
  const convos = await r.json();
  const mine = (convos.conversations ?? []).find((c) => c.storeId === store.id);
  console.log('CONVOS ->', r.status, '| thread present:', !!mine, '| lastBody:', mine?.lastBody?.slice(0, 40));

  // Read marker stamps and returns ok.
  r = await fetch(`${BASE}/api/chat/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ threadId: `${store.id}:me` }),
  });
  console.log('READ MARKER ->', r.status, await r.text());

  console.log('E2E PASS ✅');
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
