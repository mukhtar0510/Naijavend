// Fire-and-forget product events from the browser (see /api/events).
export type ClientEvent = 'cart_item_added' | 'checkout_started' | 'store_link_shared' | 'qr_downloaded' | 'buyer_enquiry';

export function trackEvent(event: ClientEvent, store: { slug?: string; storeId?: string }): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, ...store }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never break the page for analytics */
  }
}
