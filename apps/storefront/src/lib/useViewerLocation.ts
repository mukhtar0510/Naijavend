'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '@idevtenancy/shared';

export const QUICK_CITIES: Array<{ label: string; lat: number; lng: number }> = [
  { label: 'Lekki', lat: 6.4459, lng: 3.4705 },
  { label: 'Surulere', lat: 6.4969, lng: 3.3511 },
  { label: 'Abuja', lat: 9.0765, lng: 7.4712 },
];

export type LocateState = 'idle' | 'locating' | 'ready' | 'denied' | 'error';

const STORAGE_KEY = 'sf-loc';

/**
 * "Where is the viewer?" — one shared source of truth for every locator
 * surface (nearby list, radar map, store distance cards). Geolocation with
 * permission, or a quick-pick base area; remembered in localStorage only.
 */
export function useViewerLocation() {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [state, setState] = useState<LocateState>('idle');

  // Restore a previously chosen location on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { lat: number; lng: number; label?: string };
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        setOrigin({ lat: parsed.lat, lng: parsed.lng });
        if (parsed.label) setLabel(parsed.label);
        setState('ready');
      }
    } catch {
      // Ignore malformed saves.
    }
  }, []);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('error');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(p);
        setLabel('Your location');
        setState('ready');
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, label: 'Your location' }));
      },
      () => setState('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 }
    );
  }, []);

  const pickCity = useCallback((cityLabel: string, lat: number, lng: number) => {
    setOrigin({ lat, lng });
    setLabel(cityLabel);
    setState('ready');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, label: cityLabel }));
  }, []);

  const reset = useCallback(() => setState('idle'), []);

  return { origin, label, state, locate, pickCity, reset };
}
