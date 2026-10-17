// AI listing assistant: rough details (± a product photo) → title, description,
// category and tags.
//
// The photo is passed as an already-uploaded store-media URL rather than
// base64 in the request body: uploads already happen through
// /api/listings/upload-image, so re-sending it would double the payload for
// nothing. The URL is fetched here, allow-listed to our own Supabase storage
// bucket — a seller-controlled URL must never become a server-side fetch (SSRF).
//
// Input contract (packages/ai feature `listing_draft`):
//   [Hint]  rough typed details
//   [Origin] photo_used | photo_missing
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText, STORE_CATEGORIES } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import { loadBucketImage } from '@/lib/bucket-image';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-listing:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many drafts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const hint = sanitizeText(b.hint, 400);
  if (hint.length < 5) {
    return apiError(422, 'too_short', 'Describe the product or service in a few words first.');
  }

  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    const image = await loadBucketImage(b.imageUrl);
    const input = `[Hint] ${hint}\n[Origin] ${image ? 'photo_used' : 'photo_missing'}`;

    const startedAt = Date.now();
    const result = await aiComplete({ feature: 'listing_draft', input, ...(image ? { image } : {}) });
    const latencyMs = Date.now() - startedAt;

    const draft = result.draft as {
      title?: string;
      description?: string;
      category?: string;
      tags?: unknown;
    };
    const description = sanitizeText(draft.description, 2000);
    if (description.length < 10) return apiError(502, 'draft_failed', 'That draft came back empty — try again.');

    // Belt and braces: the provider already whitelists the category.
    const rawCategory = typeof draft.category === 'string' ? draft.category.trim().toLowerCase() : '';
    const category = (STORE_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null;
    const tags = (Array.isArray(draft.tags) ? draft.tags : [])
      .map((t) => sanitizeText(t, 40).toLowerCase())
      .filter((t) => t.length >= 2)
      .slice(0, 6);

    // Log usage — user_id is REQUIRED by the ai_usage_owner_insert policy.
    const { data: userData } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'listing_draft',
      input,
      tokens_used: result.tokensUsed,
      provider: result.provider,
      user_id: userData.user?.id ?? null,
      latency_ms: latencyMs,
    });

    return apiOk({
      draft: {
        title: sanitizeText(draft.title, 160),
        description,
        category,
        tags,
      },
      provider: result.provider,
      usedPhoto: !!image,
    });
  } catch (err) {
    return internalError('ai-draft-listing', err);
  }
}