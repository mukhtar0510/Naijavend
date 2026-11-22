// Browser-side product events (BUILD.md T10): cart_item_added,
// checkout_started, store_link_shared, qr_downloaded, buyer_enquiry.
// Anonymous and rate-limited; no personal data, just the event and store.
import { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { supabaseServiceOptional } from '@/lib/supabase';
import { CLIENT_EVENTS, isEventName, recordEvent } from '@/lib/events';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`events:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many events.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const event = sanitizeText(b.event, 32);
  if (!isEventName(event) || !CLIENT_EVENTS.has(event)) return apiError(422, 'invalid_event', 'Unknown event.');

  const svc = supabaseServiceOptional();
  let storeId: string | null = null;
  const slug = sanitizeText(b.slug, 80);
  const id = sanitizeText(b.storeId, 40);
  if (svc && /^[0-9a-f-]{36}$/i.test(id)) storeId = id;
  else if (svc && slug) {
    const { data } = await svc.from('stores').select('id').eq('slug', slug).maybeSingle();
    storeId = (data as { id?: string } | null)?.id ?? null;
  }
  await recordEvent(event, storeId, svc);
  return apiOk({ ok: true });
}
