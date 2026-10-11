// Buyer AI assistant — catalog-grounded + buyer-data grounded chat.
//
// Scope (explicit guardrails):
//  - Catalog facts only from public store/listings data the anon client can read.
//  - Buyer personal context only from rows the customer JWT can see (their own
//    orders, bookings, saved/faved stores, recent chats). Nothing from other
//    customers, nothing seller-internal (no seller revenue/staffing/etc.).
//  - Every response the buyer sees is rendered from real slugs/IDs, never
//    invented product text the buyer would trust as factual.
//  - Keyless fallback: without GEMINI_API_KEY the route uses deterministic
//    catalogue matching, same pattern as the rest of the AI surfaces.
//
// This is intentionally separate from the seller assistant route. The seller
// route is grounded in store stats the buyer must never see.
import { NextRequest } from 'next/server';
import { getCustomerClient } from '@/lib/auth';
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText, haversineKm, formatDistance } from '@idevtenancy/shared';
import { createProviderFromEnv } from '@idevtenancy/ai';

interface CatalogStore {
  slug: string;
  name: string;
  category: string;
  description: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number;
  reviewCount: number;
  items: Array<{ title: string; priceKobo: number; type: string }>;
}

interface BuyerContext {
  orders: Array<{
    id: string;
    totalKobo: number;
    status: string;
    storeSlug: string;
    storeName: string;
    createdAt: string;
    items: Array<{ title: string; priceKobo: number }>;
  }>;
  bookings: Array<{
    id: string;
    status: string;
    storeSlug: string;
    storeName: string;
    title: string;
    slotStart: string;
    slotEnd: string;
  }>;
  recentChatStores: Array<{ storeSlug: string; storeName: string }>;
}

interface AskAnswer {
  reply: string;
  stores?: Array<{ slug: string; name: string; category: string }>;
  orders?: Array<{ id: string; storeSlug: string; storeName: string; totalKobo: number; status: string }>;
  listings?: Array<{ storeSlug: string; title: string; priceKobo: number }>;
}

// ---------------------------------------------------------------------------
// Buyer context loader — only the customer's own rows, RLS-scoped.
// ---------------------------------------------------------------------------

async function loadBuyerContext(sb: ReturnType<typeof supabaseAnon>, customerId: string): Promise<BuyerContext> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: orderRows }, { data: bookingRows }, { data: chatRows }, { data: savedRows }] = await Promise.all([
    sb.from('orders')
      .select(`
        id,
        total_kobo,
        status,
        created_at,
        stores (slug, name),
        order_items (title, price_kobo)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('bookings')
      .select(`
        id,
        status,
        slot_start,
        slot_end,
        listings (stores (slug, name), title)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('chat_messages')
      .select('store_id, body, created_at')
      .eq('customer_id', customerId)
      .eq('sender', 'customer')
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('saved_stores')
      .select('store_id')
      .eq('customer_id', customerId)
      .limit(50),
  ]);

  const orders: BuyerContext['orders'] = [];
  for (const row of (orderRows ?? [])) {
    const store = (row as Record<string, unknown>).stores as { slug: string; name: string } | null;
    const items = ((row as Record<string, unknown>).order_items as Array<{ title: string; price_kobo: number }>) ?? [];
    if (!store) continue;
    orders.push({
      id: String((row as Record<string, unknown>).id),
      totalKobo: Number((row as Record<string, unknown>).total_kobo) ?? 0,
      status: String((row as Record<string, unknown>).status),
      storeSlug: store.slug,
      storeName: store.name,
      createdAt: String((row as Record<string, unknown>).created_at),
      items: items.map((i) => ({ title: i.title, priceKobo: i.price_kobo })),
    });
  }

  const bookings: BuyerContext['bookings'] = [];
  for (const row of (bookingRows ?? [])) {
    const listing = (row as Record<string, unknown>).listings as { stores: { slug: string; name: string } | null; title: string } | null;
    if (!listing?.stores) continue;
    bookings.push({
      id: String((row as Record<string, unknown>).id),
      status: String((row as Record<string, unknown>).status),
      storeSlug: listing.stores.slug,
      storeName: listing.stores.name,
      title: listing.title,
      slotStart: String((row as Record<string, unknown>).slot_start),
      slotEnd: String((row as Record<string, unknown>).slot_end),
    });
  }

  // Recent stores the buyer has chatted with.
  const recentChatStores: BuyerContext['recentChatStores'] = [];
  const storeIdSet = new Set<string>();
  for (const m of (chatRows ?? [])) {
    const sid = String((m as Record<string, unknown>).store_id);
    if (storeIdSet.has(sid)) continue;
    storeIdSet.add(sid);
  }
  if (storeIdSet.size) {
    const storeNames = await sb.from('stores').select('id, slug, name').in('id', [...storeIdSet]).limit(storeIdSet.size);
    for (const s of (storeNames ?? [])) {
      recentChatStores.push({ storeSlug: String(s.slug), storeName: String(s.name) });
    }
  }

  // Saved/faved stores the buyer has explicitly kept.
  const savedIds = new Set<string>();
  for (const r of (savedRows ?? [])) {
    savedIds.add(String((r as Record<string, unknown>).store_id));
  }

  return { orders, bookings, recentChatStores, savedIds };
}

// ---------------------------------------------------------------------------
// Catalog loader — public catalogue, bounded queries.
// ---------------------------------------------------------------------------

async function loadCatalog(sb: ReturnType<typeof supabaseAnon>): Promise<CatalogStore[]> {
  const [{ data: storeRows }, { data: listingRows }] = await Promise.all([
    sb.from('stores')
      .select('id, slug, name, category, description, address, latitude, longitude, store_rating_stats(review_count, avg_stars)')
      .limit(40),
    sb.from('listings')
      .select('store_id, title, price_kobo, type')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const catalogById = new Map<string, CatalogStore>();
  for (const row of (storeRows ?? []) as Array<Record<string, unknown>>) {
    const stats = (row.store_rating_stats as Array<{ review_count: number; avg_stars: number | null }> | undefined)?.[0];
    catalogById.set(String(row.id), {
      slug: String(row.slug),
      name: String(row.name),
      category: String(row.category),
      description: String(row.description ?? '').slice(0, 160),
      address: (row.address as string | null) ?? null,
      lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null,
      rating: stats?.avg_stars != null ? Number(stats.avg_stars) : 0,
      reviewCount: stats?.review_count ?? 0,
      items: [],
    });
  }
  for (const l of (listingRows ?? []) as Array<Record<string, unknown>>) {
    const store = catalogById.get(String(l.store_id));
    if (!store) continue;
    if (store.items.length >= 8) continue;
    store.items.push({
      title: String(l.title),
      priceKobo: Number(l.price_kobo) ?? 0,
      type: String(l.type),
    });
  }

  return Array.from(catalogById.values());
}

// ---------------------------------------------------------------------------
// Keyless fallback — honest catalogue + buyer-context matching.
// ---------------------------------------------------------------------------

function fallbackAnswer(
  q: string,
  catalog: CatalogStore[],
  buyer: BuyerContext,
  origin: { lat: number; lng: number } | null,
): AskAnswer {
  const lower = q.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

  // Buyer intent detection — grounded in the buyer's own data.
  const hasPersonal = (re: RegExp) => re.test(lower);
  const wantsMyOrders = hasPersonal(/(my order|my orders|where.*order|track.*order|order status|last order|recent order)/);
  const wantsMyBookings = hasPersonal(/(my booking|my appointment|my bookings|upcoming|when.*appoint|when.*booking|my schedule)/);
  const wantsOrderHelp = hasPersonal(/(cancel|change.*order|refund|where.*my)/) && hasPersonal(/(order|buy|purchase)/);

  // Catalog intent detection.
  const wantsProduct = hasPersonal(/(sell|selling|shop|store|bought|buy|find|who|where|near|nearby|cake|food|cloth|fashion|jewelry|jewellery|electronics|phone|decor|furniture|beauty)/);
  const wantsPriceOrItem = hasPersonal(/(how much|price|cost|₦|naira|cheap|expensive|which.*cheap|which.* affordable)/);

  const pickedStores: CatalogStore[] = [];

  // Personal answers first — grounded in the buyer's own rows, not invented.
  if (wantsMyOrders && buyer.orders.length) {
    const recent = buyer.orders.slice(0, 3);
    const lines = recent.map((o) => `${o.storeName} — ₦${Math.round(o.totalKobo / 100).toLocaleString('en-NG')} — ${o.status} — ${o.items.slice(0, 3).map((i) => i.title).join(', ') || 'items'}`).join('\n');
    return {
      reply: `Here are the orders I can see on your account:\n${lines}\n\nI only have details for orders placed through Naijavend stores. If you placed an order outside this list, check your messages with that seller directly.\n\nWhen did you last place an order, and what would you like to do with it?`,
      orders: recent.slice(0, 5).map((o) => ({ id: o.id, storeSlug: o.storeSlug, storeName: o.storeName, totalKobo: o.totalKobo, status: o.status })),
    };
  }

  if (wantsMyBookings && buyer.bookings.length) {
    const upcoming = buyer.bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'pending')
      .slice(0, 5);
    if (upcoming.length) {
      const lines = upcoming.map((b) => `${b.title} at ${b.storeName} — ${new Date(b.slotStart).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`).join('\n');
      return {
        reply: `Here are your upcoming bookings:\n${lines}\n\nThese are the appointments I can see on your account. If a booking isn't here, the store may hold it on their side — message them from your chats to confirm.`,
        stores: upcoming.slice(0, 5).map((b) => ({ slug: b.storeSlug, name: b.storeName, category: '' })),
      };
    }
  }

  // Catalog + buyer overlap: prefer stores the buyer has already engaged with.
  const preferredSlugs = new Set([
    ...buyer.recentChatStores.map((s) => s.storeSlug),
  );

  const scored = catalog.map((s) => {
    const hay = (`${s.name} ${s.category} ${s.description} ${s.items.map((i) => i.title).join(' ')}`).toLowerCase();
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += 2;
    }
    if (preferredSlugs.has(s.slug)) score += 3;
    if (s.rating >= 4.5) score += 0.5;
    if (origin && s.lat != null && s.lng != null && haversineKm(origin, { lat: s.lat, lng: s.lng }) < 10) score += 0.8;
    return { s, score };
  }).sort((a, b) => b.score - a.score);

  const matched = scored.filter((m) => m.score >= 2).slice(0, 4);
  const fallback = scored.filter((m) => m.score >= 1).slice(0, 4);

  if (matched.length === 0 && !wantsMyOrders && !wantsMyBookings) {
    return {
      reply: `I couldn't find anything on Naijavend matching “${q.slice(0, 80)}” yet — the marketplace grows daily, so check Discover or browse the rankings for the best-rated stores right now.`,
    };
  }

  const pick = matched.length ? matched : fallback;
  const first = pick[0]?.s;
  const itemLine = first?.items[0] ? ` Try “${first.items[0].title}” — ₦${Math.round(first.items[0].priceKobo / 100).toLocaleString('en-NG')}.` : '';
  const distLine = first && origin && first.lat != null && first.lng != null
    ? ` It's about ${formatDistance(haversineKm(origin, { lat: first.lat, lng: first.lng }))} from you.`
    : '';

  return {
    reply: `Based on what's listed on Naijavend${preferredSlugs.size ? ', including stores you've chatted with' : ''}, ${pick.map((m) => m.s.name).join(', ') || 'a few stores'} look like your best bet.${itemLine}${distLine} Tap a store below to see everything they offer.`,
    stores: pick.slice(0, 4).map((m) => ({ slug: m.s.slug, name: m.s.name, category: m.s.category })),
  };
}

// ---------------------------------------------------------------------------
// Gemini path — same contract shape, smarter reply.
// ---------------------------------------------------------------------------

async function geminiAnswer(
  q: string,
  catalog: CatalogStore[],
  buyer: BuyerContext,
  origin: { lat: number; lng: number } | null,
  label: string | null,
): Promise<AskAnswer | null> {
  const provider = createProviderFromEnv();
  if (provider.name === 'dummy') return null;

  const short = catalog.slice(0, 25);
  const catalogLines = short.map((s, i) => {
    const dist = origin && s.lat != null && s.lng != null ? `${formatDistance(haversineKm(origin, { lat: s.lat, lng: s.lng }))} away` : '';
    const items = s.items.slice(0, 4).map((it) => `${it.title} ₦${Math.round(it.priceKobo / 100)}`).join(', ');
    return `[${i}] ${s.name} (${s.category}) ${dist ? `· ${dist}` : ''}${s.rating >= 4 ? `· ⭐${s.rating.toFixed(1)}` : ''}· ${items || 'no listed items'}${s.address ? ` · ${s.address}` : ''}`;
  }).join('\n');

  const orderLines = buyer.orders.slice(0, 6).map((o) =>
    `[ORDER] ${o.storeName} — ₦${Math.round(o.totalKobo / 100)} — ${o.status} — ${o.items.slice(0, 3).map((i) => i.title).join(', ') || 'items'}`,
  ).join('\n');
  const bookingLines = buyer.bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').slice(0, 6).map((b) =>
    `[BOOKING] ${b.title} at ${b.storeName} — ${new Date(b.slotStart).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
  ).join('\n');

  const prompt = [
    'You are the Naijavend shopping assistant for a Nigerian marketplace.',
    label ? `The shopper is around ${label}.` : 'The shopper location is unknown.',
    `Shopper asked: “${q.slice(0, 300)}”`,
    '=== CATALOGUE (the ONLY store/product facts you may use — never invent products, prices, stock or availability) ===',
    catalogLines || '(no stores listed yet)',
    '=== THIS SHOPPER\'S OWN ORDERS (only if relevant) ===',
    orderLines || '(no recent orders on this account)',
    '=== THIS SHOPPER\'S OWN UPCOMING BOOKINGS (only if relevant) ===',
    bookingLines || '(no upcoming bookings on this account)',
    'Answer in 2-4 short friendly sentences.',
    'Only mention stores that exist in the catalogue above; every store MUST be referred to by its real name and, when useful, a real listed item price from the catalogue.',
    'If the question is about the shopper\'s own orders or bookings, base your answer on the ORDER/BOOKING lines above — do not invent order or booking details.',
    'If nothing matches, say so honestly and suggest browsing Discover.',
    'End with a JSON object (no markdown fence) like {"stores":[{"index":0},{"index":3}]} for at most 4 relevant store indices, or {"orders":[0,1]} / {"bookings":[0]} when you are pointing at their own rows. Use only indices that exist in the lists above.',
  ].filter(Boolean).join('\n');

  try {
    const res = await provider.complete({ feature: 'assistant_chat', input: prompt });
    const raw = typeof res.draft === 'object' && res.draft !== null && 'reply' in res.draft
      ? String((res.draft as { reply: unknown }).reply)
      : String(res.draft);

    const storeM = raw.match(/\{"stores"\s*:\s*\[[^\]]*\]\}/);
    const orderM = raw.match(/\{"orders"\s*:\s*\[[^\]]*\]\}/);
    const bookingM = raw.match(/\{"bookings"\s*:\s*\[[^\]]*\]\}/);

    let stores: Array<{ slug: string; name: string; category: string }> = [];
    let orders: Array<{ id: string; storeSlug: string; storeName: string; totalKobo: number; status: string }> = [];
    let listings: Array<{ storeSlug: string; title: string; priceKobo: number }> = [];

    if (storeM) {
      const parsed = JSON.parse(storeM[0]) as { stores?: Array<{ index?: number }> };
      for (const p of (parsed.stores ?? []).slice(0, 4)) {
        const s = short[p.index ?? -1];
        if (!s) continue;
        stores.push({ slug: s.slug, name: s.name, category: s.category });
        for (const it of s.items.slice(0, 4)) {
          listings.push({ storeSlug: s.slug, title: it.title, priceKobo: it.priceKobo });
        }
      }
    }
    if (orderM) {
      const parsed = JSON.parse(orderM[0]) as { orders?: Array<{ index?: number }> };
      for (const p of (parsed.orders ?? []).slice(0, 5)) {
        const o = buyer.orders[p.index ?? -1];
        if (!o) continue;
        orders.push({ id: o.id, storeSlug: o.storeSlug, storeName: o.storeName, totalKobo: o.totalKobo, status: o.status });
      }
    }
    if (bookingM) {
      const parsed = JSON.parse(bookingM[0]) as { bookings?: Array<{ index?: number }> };
      for (const p of (parsed.bookings ?? []).slice(0, 5)) {
        const b = buyer.bookings[p.index ?? -1];
        if (!b) continue;
        stores.push({ slug: b.storeSlug, name: b.storeName, category: '' });
      }
    }

    const reply = raw.replace(/\{"stores"[^}]*\}/, '').replace(/\{"orders"[^}]*\}/, '').replace(/\{"bookings"[^}]*\}/, '').replace(/^["'\s]+/, '').trim();
    return {
      reply: reply || (stores.length ? `Here's what fits: ${stores.map((s) => s.name).join(', ')}.` : 'I couldn\'t find a match — try browsing Discover.'),
      stores: stores.length ? stores : undefined,
      orders: orders.length ? orders : undefined,
      listings: listings.length ? listings : undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const customer = await getCustomerClient();
  if (!customer) {
    return apiError(401, 'unauthenticated', 'Sign in first.');
  }

  const rl = rateLimit(`account-ai:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many questions. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const question = sanitizeText(b.q ?? '', 300);
  if (question.length < 3) {
    return apiError(422, 'empty_question', 'Ask me something — e.g. “who sells cakes in Lekki?” or “where is my last order?”');
  }

  let origin: { lat: number; lng: number } | null = null;
  const latNum = Number(b.lat);
  const lngNum = Number(b.lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
    origin = { lat: latNum, lng: lngNum };
  }
  const label = sanitizeText(b.label ?? '', 60) || null;

  try {
    const sb = supabaseAnon();
    const [catalog, buyer] = await Promise.all([
      loadCatalog(sb),
      loadBuyerContext(sb, customer.id),
    ]);

    if (catalog.length === 0 && buyer.orders.length === 0 && buyer.bookings.length === 0) {
      return apiOk({ reply: 'The marketplace has no stores listed yet — check back soon!' });
    }

    const answer = (await geminiAnswer(question, catalog, buyer, origin, label)) ?? fallbackAnswer(question, catalog, buyer, origin);
    return apiOk(answer);
  } catch (err) {
    return internalError('account-ai-assistant', err);
  }
}
