'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { haversineKm, formatDistance, travelEstimates, directionsUrl, type LatLng } from '@idevtenancy/shared';

export interface NearbyStore {
  slug: string;
  name: string;
  address: string | null;
  category: string;
  lat: number;
  lng: number;
}

/**
 * "Near you" store locator for /discover. Asks for the viewer's geolocation on
 * request (browsers require HTTPS or localhost), then sorts stores by real
 * straight-line distance and shows walk/drive estimates. Falls back to a
 * manual area pick when geolocation is denied or unavailable.
 */
export function NearbyStores({ stores }: { stores: NearbyStore[] }) {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [state, setState] = useState<'idle' | 'locating' | 'ready' | 'denied' | 'error'>('idle');
  const [manualCity, setManualCity] = useState<string | null>(null);

  // Signed-in customers may have a saved area from a previous visit.
  useEffect(() => {
    const saved = window.localStorage.getItem('sf-loc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { lat: number; lng: number; label?: string };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setOrigin({ lat: parsed.lat, lng: parsed.lng });
          if (parsed.label) setManualCity(parsed.label);
          setState('ready');
        }
      } catch {
        // Ignore malformed saves.
      }
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

  function pickCity(label: string, lat: number, lng: number) {
    setOrigin({ lat, lng });
    setManualCity(label);
    setState('ready');
    window.localStorage.setItem('sf-loc', JSON.stringify({ lat, lng, label }));
  }

  const ranked = useMemo(() => {
    if (!origin) return null;
    return stores
      .map((s) => {
        const km = haversineKm(origin, { lat: s.lat, lng: s.lng });
        return { ...s, km, eta: travelEstimates(km) };
      })
      .sort((a, b) => a.km - b.km);
  }, [origin, stores]);

  if (stores.length === 0) return null;

  return (
    <section className="nearby" aria-label="Stores near you">
      <div className="nearby-head">
        <h2>📍 Stores near you</h2>
        {state === 'ready' && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setState('idle')}>
            Change
          </button>
        )}
      </div>

      {state === 'idle' && (
        <div className="card nearby-cta">
          <p style={{ margin: '0 0 12px' }}>
            Share your location once to see every store sorted by real distance — walking and driving time included.
            Nothing is stored on our servers; it stays in this browser.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={locate}>
              Use my location
            </button>
            <span className="nearby-cities">
              or jump to:{' '}
              <button type="button" className="nearby-city" onClick={() => pickCity('Lekki', 6.4459, 3.4705)}>Lekki</button>
              <button type="button" className="nearby-city" onClick={() => pickCity('Surulere', 6.4969, 3.3511)}>Surulere</button>
              <button type="button" className="nearby-city" onClick={() => pickCity('Abuja', 9.0765, 7.4712)}>Abuja</button>
            </span>
          </div>
        </div>
      )}

      {state === 'locating' && <div className="card nearby-cta"><p style={{ margin: 0 }}>Getting your location…</p></div>}

      {state === 'denied' && (
        <div className="card nearby-cta">
          <p style={{ margin: '0 0 10px' }}>
            Location permission was blocked — that&apos;s fine. Pick a base area instead:
          </p>
          <div className="nearby-cities">
            <button type="button" className="nearby-city" onClick={() => pickCity('Lekki', 6.4459, 3.4705)}>Lekki</button>
            <button type="button" className="nearby-city" onClick={() => pickCity('Surulere', 6.4969, 3.3511)}>Surulere</button>
            <button type="button" className="nearby-city" onClick={() => pickCity('Abuja', 9.0765, 7.4712)}>Abuja</button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="card nearby-cta"><p style={{ margin: 0 }}>This browser can&apos;t share location — pick a base area below.</p></div>
      )}

      {state === 'ready' && ranked && (
        <>
          <p className="muted nearby-sub">
            Sorted from <strong>{manualCity ?? 'your location'}</strong> — straight-line distance, city-road estimates.
          </p>
          <div className="nearby-list">
            {ranked.slice(0, 6).map((s, i) => (
              <div key={s.slug} className="card nearby-row">
                <span className="nearby-rank" aria-hidden>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/s/${s.slug}`}><strong>{s.name}</strong></Link>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.address ?? s.category}
                  </p>
                </div>
                <div className="nearby-dist" style={{ textAlign: 'right' }}>
                  <strong>{formatDistance(s.km)}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                    {s.km <= 25 ? `🚶 ${s.eta.walk} · ` : ''}🚗 {s.eta.drive}
                  </p>
                </div>
                <a className="btn btn-outline btn-sm nearby-directions" href={directionsUrl(origin, { lat: s.lat, lng: s.lng }, s.name)} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
