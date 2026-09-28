'use client';

import { useEffect, useState } from 'react';
import { haversineKm, formatDistance, travelEstimates, directionsUrl, type LatLng } from '@idevtenancy/shared';

/**
 * "Distance from you" card on the store page. Uses the viewer's geolocation
 * (with permission) or their saved base location, shows straight-line distance
 * plus walking/driving estimates and a one-tap directions link. The chosen
 * location is remembered in this browser only — nothing is sent to servers.
 */
export function DistanceCard({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [state, setState] = useState<'idle' | 'locating' | 'ready' | 'denied' | 'error'>('idle');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sf-loc');
      if (saved) {
        const parsed = JSON.parse(saved) as { lat: number; lng: number; label?: string };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setOrigin({ lat: parsed.lat, lng: parsed.lng });
          setState('ready');
        }
      }
    } catch {
      // Ignore malformed saves.
    }
  }, []);

  function locate() {
    if (!('geolocation' in navigator)) {
      setState('error');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(p);
        setState('ready');
        window.localStorage.setItem('sf-loc', JSON.stringify({ ...p, label: 'Your location' }));
      },
      () => setState('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 }
    );
  }

  const store: LatLng = { lat, lng };
  const km = origin ? haversineKm(origin, store) : null;
  const eta = km != null ? travelEstimates(km) : null;

  return (
    <div className="card distance-card">
      <h3 style={{ marginTop: 0, fontSize: 16 }}>📍 Distance from you</h3>

      {state === 'idle' && (
        <>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 10px' }}>
            Share your location once to see how far this store is from you — walking and driving estimates included.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={locate}>
            Check my distance
          </button>
        </>
      )}

      {state === 'locating' && <p className="muted" style={{ margin: 0 }}>Getting your location…</p>}

      {state === 'denied' && (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Location is blocked in your browser settings. Use the <strong>Directions</strong> button on the map instead.
        </p>
      )}

      {state === 'error' && (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>This browser can&apos;t share location.</p>
      )}

      {state === 'ready' && km != null && eta && (
        <div className="distance-body">
          <div className="distance-big">{formatDistance(km)}</div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
            straight-line · 🚶 {eta.walk} walk · 🚗 {eta.drive} drive
          </p>
          <a className="btn btn-outline btn-sm" href={directionsUrl(origin, store, name)} target="_blank" rel="noreferrer">
            Get directions ↗
          </a>
        </div>
      )}
    </div>
  );
}
