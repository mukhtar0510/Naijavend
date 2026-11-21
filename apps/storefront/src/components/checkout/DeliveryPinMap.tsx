'use client';

// Optional drop-off pin for checkout (owner, 21 Nov 2026: "make the map part
// of the checkout"). A small Ilorin map: tap to drop the pin, drag to adjust,
// or "Put the pin on me". The pin stays in the page until the buyer places the
// order; only then is it sent, for this delivery only (BUILD.md privacy rule).

import * as React from 'react';
import type { Marker } from 'maplibre-gl';
import { LocateFixed, MapPin, Trash2 } from 'lucide-react';
import { createThemedMap, ll, type ThemedMap } from '@/lib/mapFactory';
import { ILORIN_BOUNDS, ILORIN_CENTER, ILORIN_MIN_ZOOM, inIlorin } from '@/lib/ilorin';

export type Pin = { lat: number; lng: number } | null;

export function DeliveryPinMap({
  center,
  value,
  onChange,
}: {
  /** Where to open the map (the chosen area), else Ilorin centre. */
  center?: { lat: number; lng: number } | null;
  value: Pin;
  onChange: (p: Pin) => void;
}) {
  const el = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<ThemedMap | null>(null);
  const markerRef = React.useRef<Marker | null>(null);
  const libRef = React.useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Create the map once.
  React.useEffect(() => {
    let alive = true;
    let map: ThemedMap | null = null;
    (async () => {
      try {
        if (!el.current) return;
        const start = center ?? { lat: ILORIN_CENTER[0], lng: ILORIN_CENTER[1] };
        map = await createThemedMap(el.current, {
          center: [start.lat, start.lng],
          zoom: center ? 15 : 13,
          minZoom: ILORIN_MIN_ZOOM,
          maxBounds: ILORIN_BOUNDS,
          zoomControl: true,
        });
        if (!alive) {
          map.remove();
          return;
        }
        libRef.current = await import('maplibre-gl');
        mapRef.current = map;
        map.on('click', (e) => {
          const { lat, lng } = e.lngLat;
          if (!inIlorin(lat, lng)) return setNote('Pick a spot inside Ilorin.');
          setNote(null);
          onChangeRef.current({ lat, lng });
        });
        map.once('load', () => alive && setReady(true));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
  }, []);

  // Follow the chosen area.
  React.useEffect(() => {
    if (ready && center && !value) mapRef.current?.flyTo({ center: ll(center.lat, center.lng), zoom: 15, duration: 600 });
  }, [ready, center?.lat, center?.lng, value]);

  // Draw / move the pin.
  React.useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const pin = document.createElement('span');
      pin.className = 'kv-pin-drop';
      pin.setAttribute('aria-label', 'Your drop-off pin');
      const m = new lib.Marker({ element: pin, anchor: 'bottom', draggable: true }).setLngLat(ll(value.lat, value.lng)).addTo(map);
      m.on('dragend', () => {
        const p = m.getLngLat();
        if (inIlorin(p.lat, p.lng)) {
          setNote(null);
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        } else {
          setNote('Pick a spot inside Ilorin.');
          m.setLngLat(ll(value.lat, value.lng));
        }
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLngLat(ll(value.lat, value.lng));
    }
  }, [ready, value]);

  function locateMe() {
    if (!('geolocation' in navigator)) return setNote('Location is not available here. Tap the map instead.');
    setNote('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        if (!inIlorin(lat, lng)) return setNote('You seem to be outside Ilorin. Tap the map where the rider should come.');
        setNote(null);
        onChange({ lat, lng });
        mapRef.current?.flyTo({ center: ll(lat, lng), zoom: 17, duration: 600 });
      },
      () => setNote('Location is off. Tap the map where the rider should come.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  if (failed) {
    return <p className="kv-pin-note">The map could not load. Your address and landmark are enough for the rider.</p>;
  }

  return (
    <div className="kv-pin">
      <div ref={el} className="kv-pin-map" role="application" aria-label="Map: tap where the rider should come" />
      {!ready && <div className="kv-pin-loading" aria-hidden />}
      <div className="kv-pin-bar">
        <button type="button" className="btn btn-outline btn-sm" onClick={locateMe}>
          <LocateFixed size={15} aria-hidden /> Put the pin on me
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
            <Trash2 size={15} aria-hidden /> Remove pin
          </button>
        )}
      </div>
      <p className="kv-pin-note" aria-live="polite">
        {note ??
          (value ? (
            <>
              <MapPin size={13} aria-hidden /> Pin set. Drag it to adjust.
            </>
          ) : (
            'Optional. Tap the map where the rider should come.'
          ))}{' '}
        The pin is sent to the seller only with this order.
      </p>
    </div>
  );
}
