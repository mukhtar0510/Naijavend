// Buyer-facing AI recommendations for the Discover page. This is a *display*
// feature: it re-ranks the public catalogue the anon client can already read —
// it never exposes anything the buyer couldn't see anyway.
//
// - If GEMINI_API_KEY is set, Gemini sees the candidate list (name, category,
//   rating, distance, what they sell) and returns JSON picks with a friendly
//   reason per pick.
// - Without a key (or on any Gemini error) it falls back to a deterministic
//   ranker: rating × proximity × open-now, every pick with a templated reason,
//   so the surface works keyless exactly like the rest of the AI features.
import { NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { haversineKm, isOpenNow } from '@idevtenancy/shared';
import { createProviderFromEnv } from '@idevtenancy/ai';

interface Candidate {
  slug: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  reviewCount: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  open: boolean;
}

interface Pick {
  kind: 'store';
  slug: string;
  name: string;
  reason: string;
  score: number;
}

// Deterministic fallback ranker — good enough keyless, stable ordering.
function fallbackPicks(candidates: Candidate[], origin: { lat: number; lng: number } | null, interest: string): Pick[] {
  const want = interest.toLowerCase().trim();
  const scored = candidates.map((c, i) => {
    let score = c.rating + Math.min(1.2, c.reviewCount / 40);
    const reasons: string[] = [];
    if (c.rating >= 4.5) reasons.push(`rated ${c.rating.toFixed(1)}★ by customers`);
    else if (c.reviewCount >= 3) reasons.push(`${c.reviewCount} positive reviews`);
    if (c.open) {
      score += 0.5;
      reasons.push('open right now');
    }
    if (origin && c.lat != null && c.lng != null) {
      const km = haversineKm(origin, { lat: c.lat, lng: c.lng });
      score += Math.max(0, 1.5 - km / 12);
      reasons.push(`${km < 6 ? 'close to' : 'nearby — about '}${km < 6 ? 'you' : `${Math.round(km)} km away`}`);
    }
    if (want && new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(c.category + ' ' + c.description + ' ' + c.name)) {
      score += 2.5;
      reasons.push(`matches what you asked for (“${interest}”)`);
    }
    if (reasons.length === 0) reasons.push('popular on the marketplace right now');
    return { slug: c.slug, name: c.name, reason: reasons.slice(0, 2).join(' · '), score: score + (candidates.length - i) / 100, kind: 'store' as const };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

// Gemini path: give it the compact candidate table and ask for JSON picks.
// Wettbewerbs-frei: it can only pick from the slugs we hand it.
async function geminiPicks(candidates: Candidate[], origin: { lat: number; lng: number } | null, label: string | null, interest: string): Promise<Pick[] | null> {
  const provider = createProviderFromEnv();
  if (provider.name === 'dummy') return null;
  const short = candidates.slice(0, 25);
  const table = short
    .map((c, i) => {
      const dist = origin && c.lat != null && c.lng != null ? `${Math.round(haversineKm(origin, { lat: c.lat, lng: c.lng }))}km from viewer` : 'distance unknown';
      return `${i}: ${c.name} | ${c.category} | ${c.rating.toFixed(1)}★ (${c.reviewCount} reviews) | ${dist} | ${c.open ? 'open now' : 'maybe closed'} | ${(c.description || c.address || c.category).slice(0, 90)}`;
    })
    .join('\n');
  const prompt = [
    'A Nigerian shopper is on a marketplace called Naijavend.',
    label ? `They are located around ${label}.` : 'Their location is unknown.',
    interest ? `They asked for: "${interest}".` : 'They did not name an interest — pick genuinely good all-round stores.',
    'Here are the candidate stores:',
    table,
    'Pick the TOP 4 stores for this shopper. Prefer: what they asked for first, then high ratings, then proximity, then being open.',
    'Reply with ONLY a JSON array like [{"index":0,"reason":"one short friendly sentence why this fits"}]. No markdown, no extra text.',
  ].join('\n');

  try {
    const draft = await provider.complete({ feature: 'assistant_chat', input: prompt });
    const text = typeof draft.draft === 'object' && draft.draft !== null && 'reply' in draft.draft ? String((draft.draft as { reply: unknown }).reply) : String(draft.draft);
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Array<{ index?: number; reason?: string }>;
    const picks: Pick[] = [];
    for (const p of parsed.slice(0, 4)) {
      const c = short[p.index ?? -1];
      if (!c) continue;
      picks.push({ kind: 'store', slug: c.slug, name: c.name, reason: sanitizeText(p.reason ?? 'A strong match for you.', 160), score: 0 });
    }
    if (picks.length === 0) return null;
    return picks;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(`recommend:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many requests. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const q = req.nextUrl.searchParams;
  const interest = sanitizeText(q.get('q') ?? '', 80);
  let origin: { lat: number; lng: number } | null = null;
  const latNum = parseFloat(q.get('lat') ?? '');
  const lngNum = parseFloat(q.get('lng') ?? '');
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
    origin = { lat: latNum, lng: lngNum };
  }
  const label = sanitizeText(q.get('label') ?? '', 60) || null;

  try {
    const sb = supabaseAnon();
    const { data, error } = await sb
      .from('stores')
      .select('slug, name, category, description, latitude, longitude, address, business_hours, verification_status, is_dropshipper, store_rating_stats(review_count, avg_stars)')
      .limit(60);
    if (error) throw error;

    const candidates: Candidate[] = (data ?? []).map((row: Record<string, unknown>) => {
      const stats = (row.store_rating_stats as Array<{ review_count: number; avg_stars: number | null }> | undefined)?.[0];
      return {
        slug: String(row.slug),
        name: String(row.name),
        category: String(row.category),
        description: String(row.description ?? ''),
        rating: stats?.avg_stars != null ? Number(stats.avg_stars) : 3.5,
        reviewCount: stats?.review_count ?? 0,
        address: (row.address as string | null) ?? null,
        lat: row.latitude != null ? Number(row.latitude) : null,
        lng: row.longitude != null ? Number(row.longitude) : null,
        open: isOpenNow(row.business_hours as Parameters<typeof isOpenNow>[0] | null),
      };
    });
    const usable = candidates.filter((c) => c.address || c.lat != null);
    if (usable.length === 0) return apiOk({ picks: [], source: 'fallback' });

    const picks = (await geminiPicks(usable, origin, label, interest)) ?? fallbackPicks(usable, origin, interest);
    // score>0 only happens on the deterministic path; gemini picks arrive with score 0.
    return apiOk({ picks, source: picks.some((p) => p.score > 0) ? 'fallback' : 'gemini' });
  } catch (err) {
    return internalError('discover-recommend', err);
  }
}
