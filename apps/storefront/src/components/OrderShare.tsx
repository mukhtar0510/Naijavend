'use client';

import { BRAND, orderRef } from '@idevtenancy/shared';

// Share a plain-text order summary via WhatsApp — the channel Nigerian buyers
// already use for commerce. No server round-trip; the summary is built inline.
export function OrderShare({
  storeName,
  storeSlug,
  orderId,
  total,
  status,
}: {
  storeName: string;
  storeSlug: string;
  orderId: string;
  total: string;
  status: string;
}) {
  function share() {
    const site = window.location.origin;
    const text = [
      `🧾 My ${storeName} order on ${BRAND.name}`,
      `Order: ${orderRef(orderId)}`,
      `Status: ${status}`,
      `Total: ${total}`,
      `Store: ${site}/s/${storeSlug}`,
    ].join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      className="order-share"
      onClick={share}
      title="Share this order via WhatsApp"
    >
      Share 📲
    </button>
  );
}
