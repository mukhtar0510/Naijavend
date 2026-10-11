// Buyer-side shopping assistant ("Ask the AI") — grounded strictly in the live
// catalogue this anon client can already read: store names, categories,
// addresses, hours, ratings, and listing titles/prices. Guardrails from the
// AI roadmap:
//   - No hallucinated prices: the model may only reference the catalogue we
//     hand it, and every recommendation MUST come back as a store slug which
//     the client renders as a real /s/<slug> link.
//   - Hard refusal: questions with no catalogue match get a honest "nothing
//     here matches" + a browse link, never an invented product.
//   - Keyless fallback: without GEMINI_API_KEY the route keyword-matches the
//     catalogue so the surface still works (same pattern as the rest).
import { NextRequest } from 'next/server';
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

interface AskAnswer {
  reply: string;
  stores: Array<{ slug: string; name: string; category: string }>;
}

// Keyless fallback: word-overlap match of the question against store names,
// categories, descriptions and listing titles. Honest about no-match.
function fallbackAnswer(q: string, stores: CatalogStore[], origin: { lat: number; lng: number } | null): AskAnswer {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !['the', 'and', 'for', 'you', 'your', 'are', 'any', 'near', 'where', 'what', 'how', 'can', 'want', 'need'].includes(w));
  const scored = stores.map((s) => {
    const hay = `${s.name} ${s.category} ${s.description} ${s.items.map((i) => i.title).join(' ')}`.toLowerCase();
    let score = words.filter((w) => hay.includes(w)).length * 2;
    if (s.rating >= 4.5) score += 0.5;
    if (origin && s.lat != null && s.lng != null && haversineKm(origin, { lat: s.lat, lng: s.lng }) < 10) score += 0.8;
    return { s, score };
  }).sort((a, b) => b.score - a.score).slice(0, 4);
  const matched = scored.filter((m) => m.score >= 2);
  if (matched.length === 0) {
    return {
      reply: `I couldn't find anything on Naijavend matching “${q.slice(0, 80)}” yet — the marketplace grows daily, so check Discover or browse the rankings for the best-rated stores right now.`,
      stores: [],
    };
  }
  const names = matched.map((m) => m.s.name).join(', ');
  const first = matched[0].s;
  const itemLine = first.items[0] ? ` Try “${first.items[0].title}” — ₦${Math.round(first.items[0].priceKobo / 100).toLocaleString('en-NG')}.` : '';
  const distLine = origin && first.lat != null && first.lng != null
    ? ` It's about ${formatDistance(haversineKm(origin, { lat: first.lat, lng: first.lng }))} from you.`
    : '';
  return {
    reply: `Based on what's listed on Naijavend, ${names.split(',')[0].trim()} looks like your best bet.${itemLine}${distLine} Tap a store below to see everything they offer.`,
    stores: matched.map((m) => ({ slug: m.s.slug, name: m.s.name, category: m.s.category })),
  };
}

// Gemini path: hand it the compact catalogue and demand JSON with slugs only.
async function geminiAnswer(q: string, stores: CatalogStore[], origin: { lat: number; lng: number } | null, label: string | null): Promise<AskAnswer | null> {
  const provider = createProviderFromEnv();
  if (provider.name === 'dummy') return null;

  const short = stores.slice(0, 25);
  const lines = short.map((s, i) => {
    const dist = origin && s.lat != null && s.lng != null ? `${formatDistance(haversineKm(origin, { lat: s.lat, lng: s.lng }))} away` : '';
    const items = s.items.slice(0, 4).map((it) => `${it.title} ₦${Math.round(it.priceKobo / 100)}`).join(', ');
    return `[${i}] ${s.name} (${s.category}) ${dist ? `· ${dist}` : ''}${s.rating >= 4 ? `· ⭐${s.rating.toFixed(1)}` : ''}· items: ${items || 'no listed items'}${s.address ? ` · ${s.address}` : ''}`;
  }).join('\n');

  const prompt = [
    'You are the Naijavend shopping assistant for a Nigerian marketplace.',
    label ? `The shopper is around ${label}.` : '',
    `Shopper asked: "${q.slice(0, 300)}"`,
    'Catalogue (the ONLY facts you may use — never invent products or prices):',
    lines,
    'Answer in 2-4 short friendly sentences. Only mention stores that exist in the catalogue above; if nothing matches, say so honestly and suggest browsing Discover.',
    'End with a JSON object (no markdown fence) like {"stores":[{"index":0,"why":"short reason"},{"index":3,"why":"..."}]} listing at most 4 relevant stores by their catalogue index.',
  ].filter(Boolean).join('\n');

  try {
    const res = await provider.complete({ feature: 'assistant_chat', input: prompt });
    const raw = typeof res.draft === 'object' && res.draft !== null && 'reply' in res.draft
      ? String((res.draft as { reply: unknown }).reply)
      : String(res.draft);
    const m = raw.match(/\{[\s\S]*"stores"[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { stores?: Array<{ index?: number; why?: string }> };
    const picked = (parsed.stores ?? []).slice(0, 4).map((p) => short[p.index ?? -1]).filter((s): s is CatalogStore => !!s);
    // Strip the trailing JSON from the prose reply.
    const reply = raw.slice(0, m.index ?? raw.length).replace(/^["'\s]+/, '').trim();
    return {
      reply: reply || (picked.length ? `Here's what fits: ${picked.map((p) => p.name).join(', ')}.` : "I couldn't find a match — try browsing Discover."),
      stores: picked.map((s) => ({ slug: s.slug, name: s.name, category: s.category })),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`ask:${clientIp(req)}`, 20, 60_000);
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
    return apiError(422, 'empty_question', 'Ask me something — e.g. “who sells cakes in Lekki?”');
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
    // Store facts + a handful of listing titles/prices each so the assistant
    // can quote real numbers. Two queries; both bounded.
    const [{ data: storeRows, error: sErr }, { data: listingRows, error: lErr }] = await Promise.all([
      sb.from('stores')
        .select('id, slug, name, category, description, address, latitude, longitude, store_rating_stats(review_count, avg_stars)')
        .limit(30),
      sb.from('listings')
        .select('store_id, title, price_kobo, type')
        .eq('type', 'product')
        .order('created_at', { ascending: false })
        .limit(150),
    ]);
    if (sErr) throw sErr;
    if (lErr) throw lErr;

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
      if (store.items.length >= 6) continue;
      store.items.push({
        title: String(l.title),
        priceKobo: Number(l.price_kobo),
        type: String(l.type),
      });
    }

    const catalog = Array.from(catalogById.values());
    if (catalog.length === 0) {
      return apiOk({ reply: 'The marketplace has no stores listed yet — check back soon!', stores: [] });
    }

    const answer = (await geminiAnswer(question, catalog, origin, label)) ?? fallbackAnswer(question, catalog, origin);
    return apiOk(answer);
  } catch (err) {
    return internalError('discover-ask', err);
  }
}
