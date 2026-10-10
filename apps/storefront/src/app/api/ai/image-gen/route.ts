// AI image generation for the seller dashboard.
//
// NOTE: image generation is currently turned off / blank. The route still accepts
// a prompt, validates it, and logs the attempt, but it returns a blank placeholder
// instead of calling Gemini. Re-enable by wiring GEMINI_API_KEY + the image model
// and removing this guard.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import type { AiImageDraft } from '@idevtenancy/shared';

function blankImage(prompt: string): AiImageDraft {
  return {
    imageUrl: null,
    alt: `AI-generated image for: ${prompt}`,
  };
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-image-gen:${clientIp(req)}`, 12, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many image generations. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const prompt = sanitizeText(b.prompt, 1000);
  if (!prompt || prompt.length < 3) {
    return apiError(422, 'empty_prompt', 'Describe the image you want in a sentence or two.');
  }

  try {
    const store = await getOwnStore<{ id: string; name: string; category: string }>(sb, 'id, name, category');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    const { data: userData } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'image_gen',
      input: prompt,
      tokens_used: 0,
      provider: 'disabled',
      user_id: userData.user?.id ?? null,
      latency_ms: 0,
    });

    return apiOk({ image: blankImage(prompt), provider: 'disabled' });
  } catch (err) {
    return internalError('image-gen', err);
  }
}
