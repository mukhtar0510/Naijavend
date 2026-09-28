// Store analytics tracking — anonymous, write-only from the public site.
// No cookies, no personal data: just event type + page path + referrer/source.
import { NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

const TYPES = new Set(['view', 'listing_view', 'share', 'link_copy', 'chat_started']);

export async function POST(req: NextRequest) {
  // Anonymous write endpoint — without a limiter anyone could inflate any
  // store's analytics with scripted requests.
  const rl = rateLimit(`track:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many events. Slow down.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const storeId = sanitizeText(b.storeId, 40);
  const eventType = sanitizeText(b.eventType, 20);
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');
  if (!TYPES.has(eventType)) return apiError(422, 'invalid_type', 'Unknown event type.');

  const path = sanitizeText(b.path, 300) || null;
  const referrer = sanitizeText(b.referrer, 300) || null;
  const source = sanitizeText(b.source, 40) || null;

  // Fire-and-forget friendly: the client never depends on the result.
  try {
    const { error } = await supabaseAnon().from('store_events').insert({
      store_id: storeId,
      event_type: eventType,
      path,
      referrer,
      source,
    });
    if (error) {
      // Unknown store id (FK violation) — say so instead of a generic 500.
      if ((error as { code?: string }).code === '23503') {
        return apiError(404, 'store_not_found', 'Unknown store.');
      }
      throw error;
    }
    return apiOk({ tracked: true });
  } catch (err) {
    return internalError('track', err);
  }
}
