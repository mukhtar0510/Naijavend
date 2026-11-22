'use client';

// Small read-only map for the tracking page: store pin and drop-off (the
// buyer's own pin, or their area centre, labelled approximate). Lazy chunk.

import * as React from 'react';
import dynamic from 'next/dynamic';
import 'maplibre-gl/dist/maplibre-gl.css';

type Pt = { lat: number; lng: number };

const TrackMap = dynamic(() => Promise.resolve(TrackMapInner), { ssr: false, loading: () => <div className="trk-map" aria-hidden /> });

export function TrackMapLazy(props: { store: Pt | null; drop: (Pt & { approx: boolean }) | null }) {
  return (
    <section className="card trk-mapcard" aria-label="Map">
      <TrackMap {...props} />
      <p className="trk-map-note">
        Store and drop-off{props.drop?.approx ? ' (your area, approximate)' : ''}. The rider&apos;s live position isn&apos;t shown.
      </p>
    </section>
  );
}

function TrackMapInner({ store, drop }: { store: Pt | null; drop: (Pt & { approx: boolean }) | null }) {
  const el = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | null = null;
    (async () => {
      const { createThemedMap, ll } = await import('@/lib/mapFactory');
      const lib = await import('maplibre-gl');
      if (!alive || !el.current) return;
      const c = drop ?? store!;
      const map = await createThemedMap(el.current, { center: [c.lat, c.lng], zoom: 14, zoomControl: true });
      if (!alive) return map.remove();
      const pin = (cls: string, label: string) => {
        const e = document.createElement('span');
        e.className = `trk-pin ${cls}`;
        e.setAttribute('aria-label', label);
        return e;
      };
      const b = new lib.LngLatBounds();
      if (store) {
        new lib.Marker({ element: pin('is-store', 'Store') }).setLngLat(ll(store.lat, store.lng)).addTo(map);
        b.extend(ll(store.lat, store.lng));
      }
      if (drop) {
        new lib.Marker({ element: pin('is-drop', 'Drop-off') }).setLngLat(ll(drop.lat, drop.lng)).addTo(map);
        b.extend(ll(drop.lat, drop.lng));
      }
      if (store && drop) map.fitBounds(b, { padding: 50, maxZoom: 15, duration: 0 });
      cleanup = () => map.remove();
    })().catch(() => undefined);
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [store, drop]);
  return <div ref={el} className="trk-map" role="img" aria-label="Map with the store and the drop-off" />;
}
