// Product events (BUILD.md T10). Server-only, best-effort: recording an event
// must never fail the action it describes. No personal data is stored.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServiceOptional } from './supabase';

export const EVENT_NAMES = [
  'store_created',
  'store_published',
  'product_added',
  'stock_updated',
  'cart_item_added',
  'checkout_started',
  'order_created',
  'order_confirmed',
  'delivery_assigned',
  'delivery_completed',
  'booking_created',
  'store_link_shared',
  'qr_downloaded',
  'buyer_enquiry',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Events a browser may send (through /api/events); the rest are server-side only. */
export const CLIENT_EVENTS: ReadonlySet<EventName> = new Set(['cart_item_added', 'checkout_started', 'store_link_shared', 'qr_downloaded', 'buyer_enquiry']);

/** Events that make a store "weekly active" (BUILD.md T10). */
export const ACTIVE_EVENTS: EventName[] = ['product_added', 'stock_updated', 'order_confirmed', 'delivery_assigned', 'delivery_completed'];

export const isEventName = (v: unknown): v is EventName => typeof v === 'string' && (EVENT_NAMES as readonly string[]).includes(v);

export async function recordEvent(event: EventName, storeId: string | null, svc?: SupabaseClient | null): Promise<void> {
  try {
    const sb = svc ?? supabaseServiceOptional();
    if (!sb) return;
    await sb.from('platform_events').insert({ event, store_id: storeId });
  } catch {
    /* analytics never breaks the app */
  }
}
