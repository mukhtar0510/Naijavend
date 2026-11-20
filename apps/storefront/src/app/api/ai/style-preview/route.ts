// Public AI theme designer — the marketing-page preview of the seller's
// "Let AI style your store" tool. It takes a vibe brief, returns the same
// AiStyleDraft shape the dashboard consumes, and never touches a store.
//
// Deliberately unauthenticated so a visitor can try it before signing up, which
// means: strict rate limiting, no authenticated data, no usage logging.

import { NextRequest } from 'next/server';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import type { AiStyleDraft } from '@idevtenancy/shared';

const VIBES = ['', 'warm', 'elegant', 'playful', 'minimal', 'premium', 'bold', 'fresh'];

export async function POST(req: NextRequest) {
  // Public surface: tighter than the dashboard equivalent (12/min there).
  const rl = rateLimit(`ai-style-preview:${clientIp(req)}`, 6, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many style previews. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const brief = sanitizeText((body as Record<string, unknown>).brief, 300);
  if (!brief) return apiError(422, 'empty_brief', 'Describe the look you want in a sentence or two.');

  const category = sanitizeText((body as Record<string, unknown>).category, 40) || 'general';
  const vibe = VIBES.includes(brief.toLowerCase()) ? brief.toLowerCase() : '';

  try {
    // No store is read or written: the category prefix keeps palette presets
    // useful without leaking any seller data into the model.
    const result = await aiComplete({
      feature: 'style_store',
      input: `(${category})${vibe ? ` ${vibe}` : ''}: ${brief}`,
    });

    return apiOk({ style: result.draft as AiStyleDraft });
  } catch (err) {
    return internalError('style-preview', err);
  }
}
