// AI style suggestion — turns a natural-language brief into a store theme draft.
// The seller reviews/edits it in dashboard settings; nothing is applied blindly.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import type { AiStyleDraft } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  // Match the sibling AI routes (draft-store 12/min) — unbounded AI calls are
  // an unbounded cost.
  const rl = rateLimit(`ai-style:${clientIp(req)}`, 12, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many style drafts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const brief = sanitizeText((body as Record<string, unknown>).brief, 600);
  if (!brief) return apiError(422, 'empty_brief', 'Describe the look you want in a sentence or two.');

  try {
    const store = await getOwnStore<{ id: string; name: string; category: string }>(sb, 'id, name, category');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    // Vibe keywords drive font pairing, so the store NAME stays out of the
    // input — a store literally named "Studio" or "Bold" would otherwise
    // hijack the vibe match. The category prefix keeps palette presets working.
    const result = await aiComplete({
      feature: 'style_store',
      input: `(${store.category}): ${brief}`,
    });

    // Log usage so the dashboard can show AI activity per store.
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'style_store',
      input: brief,
      tokens_used: result.tokensUsed,
      provider: result.provider,
    });

    return apiOk({ style: result.draft as AiStyleDraft });
  } catch (err) {
    return internalError('style-store', err);
  }
}
