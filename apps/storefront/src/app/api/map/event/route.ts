// Anonymous map-page analytics (REDESIGN 6.4). Write-only, rate-limited, no
// location or personal data: just the event name and, for store actions, the
// store id. Best-effort: if the table isn't there yet, it quietly does nothing.
import { NextRequest } from 'next/server';
import { supabaseServiceOptional } from '@/lib/supabase';
import { apiError, apiOk } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const EVENTS = new Set([
  'map_opened',
  'pin_tapped',
  'story_viewed',
  'heat_toggled',
  'store_directions_clicked',
  'store_order_clicked',
]);

export async function POST(req: NextRequest) {
  const rl = rateLimit(`map-event:${clientIp(req)}`, 120, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many events.');

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const event = String(body.event ?? '');
  const storeId = typeof body.storeId === 'string' && /^[0-9a-f-]{36}$/i.test(body.storeId) ? body.storeId : null;
  if (!EVENTS.has(event)) return apiError(422, 'invalid_event', 'Unknown event.');

  const sb = supabaseServiceOptional();
  if (sb) {
    // Never fail the caller over analytics (missing table, FK miss, outage).
    await sb.from('map_events').insert({ event, store_id: storeId }).then(
      () => undefined,
      () => undefined,
    );
  }
  return apiOk({ ok: true });
}
