'use client';

// Store-page location map: a MapLibre map with the same basemap styles as the
// Discover locator. Shows the main pin plus optional branch pins; clicking a
// pin opens a "Get directions" bubble.
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createThemedMap, ll } from '@/lib/mapFactory';
import { ILORIN_BOUNDS, ILORIN_MIN_ZOOM, inIlorin } from '@/lib/ilorin';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  /** Optional note shown under the label in the popup. */
  address?: string | null;
  /** Optional Google-Maps directions deep link for this pin. */
  directionsUrl?: string;
  /** The store's main location (vs. a branch). Set internally. */
  main?: boolean;
}

interface InnerProps {
  pins: MapPin[];
  height?: number;
}

// Lucide (ISC) Store / MapPin glyphs as strings — markers are plain HTML.
const PIN_SVG = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const SVG_STORE = PIN_SVG('<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>');
const SVG_PIN = PIN_SVG('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>');

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function MapPins({ pins, height = 220 }: InnerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  // Serialises map lifecycles on the one container: a remount (React dev
  // double-mount, new pins) waits for the previous map to be removed first.
  const lastRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!ref.current || pins.length === 0) return;
    let map: import('maplibre-gl').Map | null = null;
    let cancelled = false;
    const prev = lastRef.current;
    lastRef.current = (async () => {
      await prev;
      const lib = await import('maplibre-gl');
      if (cancelled || !ref.current) return;
      map = await createThemedMap(ref.current, {
        center: [pins[0].lat, pins[0].lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        layerSwitch: true,
        // Ilorin-only, like the Discover map: no panning or zooming out past the city.
        maxBounds: ILORIN_BOUNDS,
        minZoom: ILORIN_MIN_ZOOM,
      });
      if (cancelled) {
        map.remove();
        map = null;
        return;
      }
      // Collapse pins that share a coordinate (e.g. a branch row with the
      // main pin's point) into ONE marker listing all names.
      const byCoord = new Map<string, MapPin[]>();
      for (const pin of pins) {
        const k = `${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
        const list = byCoord.get(k) ?? [];
        list.push(pin);
        byCoord.set(k, list);
      }
      const bounds = new lib.LngLatBounds();
      for (const group of byCoord.values()) {
        const first = group[0];
        const title = group.map((p) => esc(p.label)).join(' + ');
        const addresses = group.filter((p) => p.address);
        const body =
          (addresses.length
            ? `<br/><span style="font-size:12px">${addresses.map((p) => esc(p.address ?? '')).join('<br/>')}</span>`
            : '') +
          (first.directionsUrl
            ? `<br/><a href="${esc(first.directionsUrl)}" target="_blank" rel="noopener noreferrer">Get directions ↗</a>`
            : '');
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'map-pin-wrap';
        el.setAttribute('aria-label', group.map((p) => p.label).join(' + '));
        el.innerHTML = `<span class="map-pin map-pin-sm">${group.some((p) => p.main) ? SVG_STORE : SVG_PIN}</span>`;
        new lib.Marker({ element: el, anchor: 'center' })
          .setLngLat(ll(first.lat, first.lng))
          .setPopup(new lib.Popup({ offset: 20, className: 'map-tip' }).setHTML(`<strong>${title}</strong>${body}`))
          .addTo(map);
        bounds.extend(ll(first.lat, first.lng));
      }
      if (byCoord.size > 1) map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [pins]);

  return (
    <div
      ref={ref}
      className="map-canvas map-embed-canvas"
      style={{ height, borderRadius: 12, opacity: ready ? 1 : 0.6 }}
      role="application"
      aria-label="Store location map"
    />
  );
}

/**
 * Server-component-friendly wrapper: renders pins on a MapLibre map when
 * there are coordinates, otherwise nothing (callers hide the section).
 */
export function MapEmbed({
  latitude,
  longitude,
  name,
  height = 220,
  extraPins = [],
}: {
  latitude: number;
  longitude: number;
  name: string;
  height?: number;
  /** Additional branch pins rendered alongside the main store pin. */
  extraPins?: MapPin[];
}) {
  const directionsUrl = (lat: number, lng: number, label: string) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Stable identity so the map isn't torn down and rebuilt on every render.
  const extraKey = JSON.stringify(extraPins);
  // Only pins inside Ilorin are shown — the map is Ilorin-only.
  const pins: MapPin[] = useMemo(
    () =>
      [{ lat: latitude, lng: longitude, label: name, main: true }, ...(JSON.parse(extraKey) as MapPin[])].filter((p) =>
        inIlorin(p.lat, p.lng),
      ),
    [latitude, longitude, name, extraKey],
  );

  if (pins.length === 0) {
    return (
      <div className="map-embed map-embed-outside" role="note">
        <strong>Location outside Ilorin</strong>
        <span>Kwaravend maps cover Ilorin only. This store&apos;s pin isn&apos;t inside the city.</span>
      </div>
    );
  }

  return (
    <div className="map-embed" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapPins pins={pins} height={height} />
      <a
        className="map-embed-open"
        href={directionsUrl(latitude, longitude, name)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Google Maps"
      >
        Open in Google Maps ↗
      </a>
    </div>
  );
}
