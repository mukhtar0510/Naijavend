// Seeds labelled EXAMPLE stores in Ilorin (sample data for demos).
//
//   node --env-file=.env.local scripts/seed-example-stores.mjs          # create/update
//   node --env-file=.env.local scripts/seed-example-stores.mjs --remove # delete them all
//
// Rules (REDESIGN.md honesty): every store here is is_example = true, shown in
// the UI as "Example store · Sample data", cannot take orders (create-order
// rejects it), has no phone number, and is owned by one dedicated examples
// account so it can be removed in one step. Names are invented and generic —
// they are not real Ilorin businesses. Idempotent; only touches slugs that
// start with "example-" AND are already flagged is_example (never a real store).

import { randomBytes } from 'node:crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const EXAMPLES_EMAIL = 'examples@kwaravend.test';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, init = {}) {
  const res = await fetch(`${URL_}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

const WEEK = (open, close, sun = null) => ({
  mon: [open, close], tue: [open, close], wed: [open, close], thu: [open, close],
  fri: [open, close], sat: [open, close], sun,
});
const naira = (n) => n * 100; // kobo

const STORES = [
  {
    slug: 'example-taiwo-road-kitchen', name: 'Taiwo Road Kitchen', category: 'food', business_type: 'product',
    address: 'Taiwo Road, Ilorin', lat: 8.4935, lng: 4.5486, hours: WEEK('09:00', '21:00', ['12:00', '20:00']),
    about: 'Home-style Nigerian meals, packed for pickup or delivery.',
    items: [
      ['Jollof rice and chicken', 3500, 'Party-style jollof with fried plantain and grilled chicken.'],
      ['Amala, ewedu and gbegiri', 2500, 'Soft amala with ewedu, gbegiri and beef.'],
      ['Pounded yam and egusi', 3000, 'Smooth pounded yam with egusi soup and assorted meat.'],
    ],
  },
  {
    slug: 'example-fate-cake-studio', name: 'Fate Cake Studio', category: 'food', business_type: 'product',
    address: 'Fate Road, Ilorin', lat: 8.5132, lng: 4.5703, hours: WEEK('10:00', '19:00'),
    about: 'Celebration cakes, cupcakes and small chops to order.',
    items: [
      ['Birthday cake, 8 inch', 25000, 'Two-layer vanilla or chocolate cake with buttercream.'],
      ['Cupcakes, box of 6', 6000, 'Assorted flavours with a message topper.'],
      ['Small chops pack', 5000, 'Puff-puff, samosa, spring rolls and gizdodo.'],
    ],
  },
  {
    slug: 'example-tanke-braids', name: 'Tanke Braids & Hair', category: 'beauty', business_type: 'service',
    address: 'Tanke, Ilorin', lat: 8.4752, lng: 4.6012, hours: WEEK('08:00', '20:00', ['13:00', '19:00']),
    about: 'Braids, cornrows and wig installs. Book a slot.',
    service: true,
    items: [
      ['Knotless braids, mid-back', 15000, 'About 5 hours. Hair extensions included.'],
      ['Cornrows, all back', 6000, 'About 2 hours.'],
      ['Wig install and styling', 10000, 'Frontal or closure install with styling.'],
    ],
  },
  {
    slug: 'example-ipata-fresh-groceries', name: 'Ipata Fresh Groceries', category: 'groceries', business_type: 'product',
    address: 'Ipata Market, Ilorin', lat: 8.5086, lng: 4.5548, hours: WEEK('07:00', '18:30'),
    about: 'Foodstuff and fresh produce from Ipata market.',
    items: [
      ['Rice, 5 kg bag', 9500, 'Long-grain parboiled rice.'],
      ['Palm oil, 1 litre', 2800, 'Fresh red palm oil.'],
      ['Tomatoes, small basket', 7000, 'Fresh tomatoes, about 4 kg.'],
    ],
  },
  {
    slug: 'example-gra-fashion-house', name: 'GRA Fashion House', category: 'fashion', business_type: 'product',
    address: 'GRA, Ilorin', lat: 8.5005, lng: 4.5652, hours: WEEK('09:00', '18:00'),
    about: 'Ready-to-wear and made-to-measure Ankara and Adire.',
    items: [
      ['Ankara gown', 18000, 'Made to measure, about one week.'],
      ['Agbada set, three pieces', 45000, 'Embroidered agbada with cap.'],
      ['Adire shirt', 12000, 'Hand-dyed adire, short sleeve.'],
    ],
  },
  {
    slug: 'example-post-office-phone-hub', name: 'Post Office Phone Hub', category: 'electronics', business_type: 'product',
    address: 'Post Office area, Ilorin', lat: 8.4921, lng: 4.5428, hours: WEEK('09:00', '19:00'),
    about: 'Phone accessories and quick fixes.',
    items: [
      ['Fast charger, USB-C', 4500, '20 W charger with cable.'],
      ['Power bank, 20,000 mAh', 18000, 'Two USB ports, LED level indicator.'],
      ['Screen protector, fitted', 2000, 'Tempered glass, fitted in store.'],
    ],
  },
  {
    slug: 'example-challenge-home-fix', name: 'Challenge Home Fix', category: 'home-services', business_type: 'service',
    address: 'Challenge, Ilorin', lat: 8.4612, lng: 4.5569, hours: WEEK('08:00', '18:00'),
    about: 'Plumbing, electrical and AC servicing around Ilorin.',
    service: true,
    items: [
      ['Plumbing visit', 5000, 'Call-out and first hour of work. Parts extra.'],
      ['Electrical repair', 7000, 'Sockets, switches and wiring faults.'],
      ['AC servicing', 12000, 'Clean and gas check for one split unit.'],
    ],
  },
  {
    slug: 'example-oke-odo-tutors', name: 'Oke-Odo Lesson Centre', category: 'education', business_type: 'service',
    address: 'Oke-Odo, Tanke, Ilorin', lat: 8.4806, lng: 4.6184, hours: WEEK('15:00', '19:00', null),
    about: 'After-school lessons and exam preparation.',
    service: true,
    items: [
      ['WAEC mathematics, monthly', 20000, 'Three evening classes a week.'],
      ['JAMB preparation, monthly', 25000, 'Use of English, maths and two subjects.'],
    ],
  },
];

async function findExamplesUser() {
  for (let page = 1; page <= 20; page++) {
    const body = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = body?.users ?? [];
    const hit = users.find((u) => u.email === EXAMPLES_EMAIL);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function examplesUserId() {
  const existing = await findExamplesUser();
  if (existing) return existing.id;
  // Random password that is never printed or stored: nobody signs in as this
  // account; it only owns the example stores.
  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: EXAMPLES_EMAIL,
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { purpose: 'example-stores' },
    }),
  });
  console.log('created examples account');
  return created.id;
}

async function existingBySlug(slugs) {
  const list = slugs.map((s) => `"${s}"`).join(',');
  return api(`/rest/v1/stores?select=id,slug,is_example&slug=in.(${list})`);
}

async function remove() {
  const rows = await api(`/rest/v1/stores?select=id,slug&is_example=eq.true&slug=like.example-*`);
  for (const r of rows) {
    await api(`/rest/v1/stores?id=eq.${r.id}&is_example=eq.true`, { method: 'DELETE' });
    console.log('removed', r.slug);
  }
}

async function seed() {
  const owner = await examplesUserId();
  const existing = await existingBySlug(STORES.map((s) => s.slug));
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  for (const s of STORES) {
    const prev = bySlug.get(s.slug);
    if (prev && !prev.is_example) {
      console.warn(`skip ${s.slug}: a real store already uses this slug`);
      continue;
    }
    const row = {
      owner_id: owner,
      name: s.name,
      slug: s.slug,
      business_type: s.business_type,
      category: s.category,
      description: `Example store with sample data, for demonstration only. ${s.about}`,
      address: s.address,
      latitude: s.lat,
      longitude: s.lng,
      whatsapp_number: '',
      business_hours: s.hours,
      is_example: true,
    };
    let storeId;
    if (prev) {
      await api(`/rest/v1/stores?id=eq.${prev.id}&is_example=eq.true`, { method: 'PATCH', body: JSON.stringify(row) });
      storeId = prev.id;
      // Refresh sample listings (example store only).
      await api(`/rest/v1/listings?store_id=eq.${storeId}`, { method: 'DELETE' });
    } else {
      const [created] = await api('/rest/v1/stores', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      storeId = created.id;
    }
    const listings = s.items.map(([title, price, description]) => ({
      store_id: storeId,
      type: s.service ? 'service' : 'product',
      is_bookable: !!s.service,
      title,
      description,
      price_kobo: naira(price),
      category: s.category,
      image_urls: [],
    }));
    await api('/rest/v1/listings', { method: 'POST', body: JSON.stringify(listings) });
    console.log(`${prev ? 'updated' : 'created'} ${s.slug} (${listings.length} listings)`);
  }
}

(process.argv.includes('--remove') ? remove() : seed()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
