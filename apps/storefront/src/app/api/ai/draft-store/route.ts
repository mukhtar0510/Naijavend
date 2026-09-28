// AI store-draft preview for the onboarding UI. Rate limited; final persistence
// happens in /api/onboarding so the seller always reviews before publishing.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-draft:${clientIp(req)}`, 12, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many drafts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const input = sanitizeText((body as Record<string, unknown>).businessDescription, 600);
  if (input.length < 10) return apiError(422, 'too_short', 'Describe your business in at least 10 characters.');

  try {
    const result = await aiComplete({ feature: 'store_setup', input });
    return apiOk({ draft: result.draft, provider: result.provider });
  } catch (err) {
    return internalError('ai-draft-store', err);
  }
}
