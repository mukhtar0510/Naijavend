'use client';

import { useEffect } from 'react';

// Records one 'view' per store per browser session (sessionStorage dedupe)
// plus a 'listing_view' when on a listing page. Renders nothing.
export function TrackStoreView({
  storeId,
  listingId,
}: {
  storeId: string;
  listingId?: string;
}) {
  useEffect(() => {
    const key = `vnd-view-${storeId}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        void fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId,
            eventType: 'view',
            path: window.location.pathname,
            referrer: document.referrer || undefined,
          }),
        }).catch(() => undefined);
      }
    } catch {
      // sessionStorage unavailable (private mode) — track anyway
      void fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, eventType: 'view', path: window.location.pathname }),
      }).catch(() => undefined);
    }
  }, [storeId]);

  useEffect(() => {
    if (!listingId) return;
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, eventType: 'listing_view', path: window.location.pathname }),
    }).catch(() => undefined);
  }, [storeId, listingId]);

  return null;
}
