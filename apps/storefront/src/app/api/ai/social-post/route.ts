// AI-drafted social posts (WhatsApp status / Instagram / Facebook) for the
// seller's dashboard. Stateless — the seller copies the caption out. Rate
// limited; logged to ai_usage_log with user_id (RLS requires it) + latency.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import type { AiSocialPostDraft } from '@idevtenancy/shared';

const PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook']);

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-social:${clientIp(req)}`, 20, 60_000);
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
  const topic = sanitizeText(b.topic, 300);
  if (topic.length < 3) return apiError(422, 'empty_topic', 'What is the post about? Name the product or promo.');
  const platform = typeof b.platform === 'string' && PLATFORMS.has(b.platform) ? b.platform : 'whatsapp';

  try {
    const store = await getOwnStore<{ id: string; name: string; category: string }>(sb, 'id, name, category');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    const input = [
      `[Store] ${store.name} | category: ${store.category}`,
      `[Platform] ${platform}`,
      `[Topic] ${topic}`,
    ].join('\n');

    const startedAt = Date.now();
    const result = await aiComplete({ feature: 'social_post', input });
    const latencyMs = Date.now() - startedAt;

    const { data: userData } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'social_post',
      input,
      tokens_used: result.tokensUsed,
      provider: result.provider,
      user_id: userData.user?.id ?? null,
      latency_ms: latencyMs,
    });

    return apiOk({ post: (result.draft as AiSocialPostDraft).post, provider: result.provider });
  } catch (err) {
    return internalError('ai-social-post', err);
  }
}
