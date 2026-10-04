// AI listing-description draft for the listing editor (blueprint §5 feature 2).
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';

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
  const input = sanitizeText((body as Record<string, unknown>).hint, 400);
  if (input.length < 5) return apiError(422, 'too_short', 'Describe the product or service in a few words first.');

  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    const startedAt = Date.now();
    const result = await aiComplete({ feature: 'listing_description', input });
    const latencyMs = Date.now() - startedAt;

    // Log usage — user_id is REQUIRED by the ai_usage_owner_insert policy.
    const { data: userData } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'listing_description',
      input,
      tokens_used: result.tokensUsed,
      provider: result.provider,
      user_id: userData.user?.id ?? null,
      latency_ms: latencyMs,
    });

    return apiOk({ draft: result.draft, provider: result.provider });
  } catch (err) {
    return internalError('ai-draft-listing', err);
  }
}
