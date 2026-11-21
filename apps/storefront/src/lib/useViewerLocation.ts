'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '@idevtenancy/shared';

// Quick picks are Ilorin districts, not nationwide cities: the marketplace is
// Ilorin-only for launch.
export const QUICK_CITIES: Array<{ label: string; lat: number; lng: number }> = [
  { label: 'Ilorin centre', lat: 8.4966, lng: 4.5421 },
  { label: 'Tanke', lat: 8.475, lng: 4.59 },
  { label: 'Fate', lat: 8.53, lng: 4.55 },
];

export type LocateState = 'idle' | 'locating' | 'ready' | 'denied' | 'error';
/** Where the origin came from: the device's GPS, or an area the viewer picked. */
export type LocationSource = 'gps' | 'pick';

const STORAGE_KEY = 'sf-loc';
const GPS_LABEL = 'Your location';
// Exact position: ask the GPS chip (not Wi-Fi/IP guesses) and never accept a
// cached fix — an old position is the usual reason a dot lands in the wrong place.
const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

function save(v: { lat: number; lng: number; label: string; source: LocationSource; accuracy?: number | null }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/**
 * "Where is the viewer?" — one shared source of truth for every locator
 * surface (nearby list, maps, store distance cards). The position never
 * leaves the browser: it lives in React state and localStorage only.
 *
 * `live: true` (the map pages) keeps following the device with
 * watchPosition while the page is open, so the blue dot is the viewer's
 * exact, current position — and starts automatically when the browser has
 * already granted location permission.
 */
export function useViewerLocation({ live = false }: { live?: boolean } = {}) {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [state, setState] = useState<LocateState>('idle');
  const [source, setSource] = useState<LocationSource | null>(null);
  /** GPS accuracy radius in metres (null for picked areas). */
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);

  const apply = useCallback((pos: GeolocationPosition) => {
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setOrigin(p);
    setLabel(GPS_LABEL);
    setSource('gps');
    setAccuracy(Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null);
    setState('ready');
    save({ ...p, label: GPS_LABEL, source: 'gps', accuracy: pos.coords.accuracy });
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId.current != null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (!live || !('geolocation' in navigator) || watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(apply, () => stopWatch(), PRECISE);
  }, [live, apply, stopWatch]);

  // Restore a previously chosen location on mount; on live pages, refresh a
  // GPS one straight away if permission was already granted.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { lat: number; lng: number; label?: string; source?: LocationSource };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          const src: LocationSource = parsed.source ?? (parsed.label === GPS_LABEL ? 'gps' : 'pick');
          setOrigin({ lat: parsed.lat, lng: parsed.lng });
          if (parsed.label) setLabel(parsed.label);
          setSource(src);
          setState('ready');
        }
      }
    } catch {
      // Ignore malformed saves.
    }
    if (!live || !('permissions' in navigator)) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'granted') startWatch();
      })
      .catch(() => undefined);
    return stopWatch;
  }, [live, startWatch, stopWatch]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('error');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apply(pos);
        startWatch();
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      PRECISE,
    );
  }, [apply, startWatch]);

  const pickCity = useCallback(
    (cityLabel: string, lat: number, lng: number) => {
      stopWatch();
      setOrigin({ lat, lng });
      setLabel(cityLabel);
      setSource('pick');
      setAccuracy(null);
      setState('ready');
      save({ lat, lng, label: cityLabel, source: 'pick' });
    },
    [stopWatch],
  );

  const reset = useCallback(() => setState('idle'), []);

  return { origin, label, state, source, accuracy, locate, pickCity, reset };
}
