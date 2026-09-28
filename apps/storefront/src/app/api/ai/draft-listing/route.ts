// AI listing-description draft for the listing editor (blueprint §5 feature 2).
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
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
    const result = await aiComplete({ feature: 'listing_description', input });
    return apiOk({ draft: result.draft, provider: result.provider });
  } catch (err) {
    return internalError('ai-draft-listing', err);
  }
}
