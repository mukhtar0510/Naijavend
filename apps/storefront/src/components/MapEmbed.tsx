'use client';

// Store-page location map — a real Leaflet map (same themed tiles as the
// discover locator) instead of the old keyless Google iframe. Shows the main
// pin plus optional branch pins; clicking a pin opens a "Get directions" bubble.
// Falls back to the Google iframe only if the container never mounts (SSR-safe
// wrapper below keeps the page server-renderable).
import { useEffect, useRef, useState } from 'react';
import { createThemedMap } from '@/lib/mapFactory';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  /** Optional note shown under the label in the popup. */
  address?: string | null;
  /** Optional Google-Maps directions deep link for this pin. */
  directionsUrl?: string;
}

interface InnerProps {
  pins: MapPin[];
  height?: number;
}

function LeafletPins({ pins, height = 220 }: InnerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current || pins.length === 0) return;
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !ref.current) return;
      map = await createThemedMap(ref.current, {
        center: [pins[0].lat, pins[0].lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      if (cancelled) {
        map.remove();
        return;
      }
      const pts: [number, number][] = [];
      // Detect duplicate coordinates (e.g. branch rows with the same point as
      // the main pin) so we can collapse them into ONE marker listing all names.
      const byCoord = new Map<string, MapPin[]>();
      for (const pin of pins) {
        const k = `${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
        const list = byCoord.get(k) ?? [];
        list.push(pin);
        byCoord.set(k, list);
      }
      for (const group of byCoord.values()) {
        const first = group[0];
        // One marker per distinct coordinate; popup lists every label in the group.
        const title = group.map((p) => p.label.replace(/</g, '&lt;')).join(' + ');
        const addresses = group.filter((p) => p.address);
        const body =
          (addresses.length
            ? `<br/><span style="font-size:12px">${addresses.map((p) => (p.address ?? '').replace(/</g, '&lt;')).join('<br/>')}</span>`
            : '') +
          (first.directionsUrl
            ? `<br/><a href="${first.directionsUrl}" target="_blank" rel="noopener noreferrer">Get directions ↗</a>`
            : '');
        L.marker([first.lat, first.lng])
          .addTo(map)
          .bindPopup(`<strong>${title}</strong>${body}`);
        pts.push([first.lat, first.lng]);
      }
      if (pts.length > 1) {
        map.fitBounds(
          (L as unknown as { latLngBounds(pts: [number, number][]): { pad(n: number): unknown } }).latLngBounds(pts).pad(0.3) as never,
          { maxZoom: 16 }
        );
      }
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
 * Server-component-friendly wrapper: renders pins on a Leaflet map when
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

  const pins: MapPin[] = [
    { lat: latitude, lng: longitude, label: name },
    ...extraPins,
  ];

  return (
    <div className="map-embed" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <LeafletPins pins={pins} height={height} />
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
