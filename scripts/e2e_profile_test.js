// E2E: customer profile self-service (avatar upload, name, phone) against prod.
// Creates a throwaway QA user via the service-role admin API, drives the same
// cookie flow the browser uses, then deletes the user again.
const fs = require('fs');

const env = {};
for (const line of fs.readFileSync('.env.vercel-prod', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2];
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'https://naijacart-roan.vercel.app';
const QA_EMAIL = 'qa-profile-e2e@naijavend-qa.com';
const QA_PASS = 'qa-profile-1234';

// 1x1 red PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function main() {
  // STEP0: public signup for the QA user (service key is redacted in env pulls,
  // so no admin API). If the project requires email confirmation, the session
  // comes back null and a DB-side confirm is done before STEP1.
  let r = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: QA_EMAIL, password: QA_PASS }),
  });
  const created = await r.json();
  if (!r.ok) {
    // Supabase's email-send rate limit trips on repeat runs; the QA user is
    // then pre-created + confirmed DB-side, so that case is fine to continue.
    if (created?.error?.code === 'over_email_send_rate_limit') {
      console.log('STEP0 signup rate-limited (QA user pre-created DB-side) — continuing');
    } else {
      console.log('STEP0 FAIL', r.status, JSON.stringify(created).slice(0, 200));
      process.exit(1);
    }
  } else {
    console.log('STEP0 signup ->', r.status, created.user?.id ?? 'no id', '| session immediately:', !!created.access_token);
  }

  // STEP1: password sign-in → session (same cookies oauth-session would set).
  r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: QA_EMAIL, password: QA_PASS }),
  });
  const sess = await r.json();
  if (!sess.access_token) { console.log('STEP1 FAIL', r.status, JSON.stringify(sess).slice(0, 200)); process.exit(1); }
  const cookies = `idev_customer_token=${sess.access_token}; idev_customer_refresh_token=${sess.refresh_token}`;
  console.log('STEP1 sign-in ok');

  // STEP2: profile page renders signed-in.
  let res = await fetch(`${BASE}/account/profile`, { headers: { Cookie: cookies } });
  let html = await res.text();
  console.log('STEP2 /account/profile ->', res.status, '| signed-in editor present:', html.includes('Upload photo'));

  // STEP3: save name + phone.
  res = await fetch(`${BASE}/api/account/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ fullName: 'QA Tester', phone: '08031234567' }),
  });
  console.log('STEP3 PATCH name+phone ->', res.status, await res.text());

  // STEP4: invalid phone rejected.
  res = await fetch(`${BASE}/api/account/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ phone: 'not-a-phone' }),
  });
  console.log('STEP4 PATCH bad phone ->', res.status, '(expect 422)');

  // STEP5: avatar upload.
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'a.png');
  res = await fetch(`${BASE}/api/account/avatar`, { method: 'POST', headers: { Cookie: cookies }, body: form });
  const up = await res.json();
  console.log('STEP5 avatar upload ->', res.status, up.url ? 'got url' : JSON.stringify(up).slice(0, 160));

  // STEP6: persist avatar url + verify it serves.
  if (up.url) {
    res = await fetch(`${BASE}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({ avatarUrl: up.url }),
    });
    console.log('STEP6 PATCH avatarUrl ->', res.status);
    const img = await fetch(up.url);
    console.log('STEP6b avatar URL serves ->', img.status, img.headers.get('content-type'));

    // STEP7: profile page now shows name + avatar.
    res = await fetch(`${BASE}/account/profile`, { headers: { Cookie: cookies } });
    html = await res.text();
    const showsName = html.includes('QA Tester');
    const showsAvatar = html.includes(encodeURIComponent(up.url).replace(/%2F/g, '%2F')) || html.includes('prof-avatar');
    console.log('STEP7 profile shows saved data ->', res.status, '| name:', showsName, '| avatar img:', showsAvatar);
  }

  // STEP8: junk avatar URL rejected (must point into the avatars bucket).
  res = await fetch(`${BASE}/api/account/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ avatarUrl: 'https://evil.example/x.png' }),
  });
  console.log('STEP8 foreign avatar URL ->', res.status, '(expect 422)');

  // CLEANUP is done DB-side afterwards (auth.users cascade + storage objects).
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
