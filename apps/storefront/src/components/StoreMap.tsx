'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import {
  directionsUrl,
  formatDistance,
  haversineKm,
  isOpenNow,
  todayHoursLabel,
  travelEstimates,
  categoryEmoji,
} from '@idevtenancy/shared';
import { QUICK_CITIES, useViewerLocation } from '@/lib/useViewerLocation';
import { createThemedMap } from '@/lib/mapFactory';
import { VerifiedTick } from '@/components/VerifiedTick';

export interface MapStore {
  slug: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  logo: string | null;
  isDropshipper: boolean;
  verified: boolean;
  rating: number | null;
  reviewCount: number | null;
  hours: Record<string, [string, string] | null | undefined> | null;
}

const DEFAULT_CENTER: [number, number] = [6.4459, 3.4705]; // Lagos

/** A fetched walking route (OSRM foot profile) or the straight-line fallback. */
interface RouteInfo {
  km: number;
  min: number;
  real: boolean; // false → haversine fallback line
}

/**
 * Street-level map tab (OpenStreetMap tiles — real roads, buildings and
 * landmarks). The viewer is a pulsing blue dot; every store is a bubble pin
 * with an open-now dot. Clicking a pin opens a card with distance, ETA and a
 * pinned "how to get there" directions link.
 */
export function StoreMap({ stores }: { stores: MapStore[] }) {
  const { origin, label, state, locate, pickCity, reset } = useViewerLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const userRef = useRef<LayerGroup | null>(null);
  const routeRef = useRef<LayerGroup | null>(null);
  // origin+store → route; avoids refetching OSRM while panning between pins.
  const routeCacheRef = useRef<Map<string, RouteInfo>>(new Map());

  const plotted = useMemo(() => {
    return stores
      .filter((s) => (cat ? s.category === cat : true))
      .map((s) => ({
        ...s,
        km: origin ? haversineKm(origin, { lat: s.lat, lng: s.lng }) : null,
        open: isOpenNow(s.hours),
        hoursToday: todayHoursLabel(s.hours),
      }))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  }, [stores, cat, origin]);

  const sel = plotted.find((p) => p.slug === selected) ?? null;

  // Initialise the map once (client only) — themed tiles follow light/dark mode.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = await createThemedMap(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        scrollWheelZoom: false, // don't hijack page scroll; double-click/tap zooms
        zoomControl: true, // explicit +/- now that tiles are CARTO (small, unobtrusive)
      });
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      cleanup = () => {
        map.remove();
        mapRef.current = null;
        markersRef.current = null;
        userRef.current = null;
      };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Store pins — rebuilt when the store set/filter changes.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current;
      if (cancelled || !map) return;
      markersRef.current?.remove();
      const group = L.layerGroup().addTo(map);
      markersRef.current = group;

      for (const s of plotted) {
        const logo = s.logo ? `<img src="${s.logo.replace(/"/g, '%22')}" alt="" />` : categoryEmoji(s.category);
        const html = `<span class="map-pin">${logo}<i data-open="${s.open ? '1' : '0'}"></i></span>`;
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({ className: 'map-pin-wrap', html, iconSize: [44, 44], iconAnchor: [22, 22] }),
          title: `${s.name}${s.km != null ? ` · ${formatDistance(s.km)}` : ''}`,
          riseOnHover: true,
        })
          .addTo(group)
          .on('click', function (this: import('leaflet').Marker) {
            // Overlapping pins: lift the clicked one above its neighbours so the
            // next click in a stack targets a different pin.
            this.setZIndexOffset(1000);
            setSelected(s.slug);
          });
      }

      const pts = plotted.map((p) => [p.lat, p.lng] as [number, number]);
      if (origin) pts.push([origin.lat, origin.lng]);
      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 14);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, plotted, origin]);

  // Viewer marker + follow.
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current;
      if (!map) return;
      userRef.current?.remove();
      userRef.current = null;
      if (!origin) return;
      const g = L.layerGroup().addTo(map);
      userRef.current = g;
      L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({
          className: 'map-me-wrap',
          html: '<span class="map-me"><i></i></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        interactive: false,
      }).addTo(g);
      map.flyTo([origin.lat, origin.lng], 13, { duration: 0.8 });
    })();
  }, [ready, origin]);

  // Walking route from the viewer to the selected store — real footpath via the
  // public OSRM demo router, dashed straight line as fallback. Cached per pair.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !sel || !origin) {
      routeRef.current?.remove();
      routeRef.current = null;
      setRoute(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;

      const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${sel.slug}`;
      const cached = routeCacheRef.current.get(key);
      if (cached) {
        setRoute(cached);
        return;
      }

      routeRef.current?.remove();
      routeRef.current = null;
      setRoute(null);

      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const line = (coords: [number, number][], dashed: boolean) =>
        L.polyline(coords, {
          color: dark ? '#60A5FA' : '#1D4ED8',
          weight: 4,
          opacity: 0.85,
          dashArray: dashed ? '6 8' : undefined,
          lineCap: 'round',
        });

      let drawn: RouteInfo | null = null;
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${sel.lng},${sel.lat}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(6000) },
        );
        const body = await res.json();
        const r = body?.routes?.[0];
        if (res.ok && r?.geometry?.coordinates?.length > 1) {
          const coords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          const km = r.distance / 1000;
          const min = Math.max(1, Math.round(r.duration / 60));
          drawn = { km, min, real: true };
          routeRef.current = L.layerGroup([line(coords, false)]).addTo(map);
          map.fitBounds(L.latLngBounds(coords).pad(0.2), { maxZoom: 16 });
        }
      } catch {
        // OSRM unreachable / timeout — fall through to the straight line.
      }
      if (!drawn && !cancelled) {
        const km = sel.km ?? 0;
        drawn = { km, min: Math.round((km / 4.8) * 60), real: false };
        routeRef.current = L.layerGroup([line([[origin.lat, origin.lng], [sel.lat, sel.lng]], true)]).addTo(map);
      }
      if (!cancelled && drawn) {
        routeCacheRef.current.set(key, drawn);
        setRoute(drawn);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, sel, origin]);

  function recenter() {
    const map = mapRef.current;
    if (!map) return;
    if (origin) map.flyTo([origin.lat, origin.lng], 13, { duration: 0.8 });
    else locate();
  }

  return (
    <section className="storemap" aria-label="Street map of stores">
      <div className="radar-head">
        <h2>🗺️ Map view</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={recenter} title="Centre on my location">
            ⌖ Me
          </button>
          {state === 'ready' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
              Change
            </button>
          )}
        </div>
      </div>

      {categoriesOf(stores).length > 1 && (
        <div className="radar-cats" role="group" aria-label="Filter map by category">
          <button type="button" className={`radar-cat${cat === null ? ' on' : ''}`} onClick={() => { setCat(null); setSelected(null); }}>
            All
          </button>
          {categoriesOf(stores).map((c) => (
            <button key={c} type="button" className={`radar-cat${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setSelected(null); }}>
              {categoryEmoji(c)} {c}
            </button>
          ))}
        </div>
      )}

      {state === 'idle' && (
        <div className="card radar-cta">
          <p style={{ margin: '0 0 12px' }}>
            Turn on your location to see yourself on the map, real distances to every store, and one-tap directions.
            Your location stays in this browser.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={locate}>
              Show my location
            </button>
            <span className="nearby-cities">
              or jump to:{' '}
              {QUICK_CITIES.map((c) => (
                <button key={c.label} type="button" className="nearby-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                  {c.label}
                </button>
              ))}
            </span>
          </div>
        </div>
      )}
      {state === 'locating' && <div className="card radar-cta"><p style={{ margin: 0 }}>Locating you…</p></div>}
      {state === 'denied' && (
        <div className="card radar-cta">
          <p style={{ margin: '0 0 10px' }}>Location is blocked — pick a base area to centre the map:</p>
          <div className="nearby-cities">
            {QUICK_CITIES.map((c) => (
              <button key={c.label} type="button" className="nearby-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="card radar-cta">
          <p style={{ margin: 0 }}>This browser can&apos;t share location — pick a base area:</p>
          <div className="nearby-cities" style={{ marginTop: 10 }}>
            {QUICK_CITIES.map((c) => (
              <button key={c.label} type="button" className="nearby-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="map-frame">
        <div ref={containerRef} className="map-canvas" role="application" aria-label="Interactive map of stores" />
      </div>

      {sel && origin && sel.km != null && (
        <div className="card radar-card">
          <div className="radar-card-top">
            {sel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
              <img className="radar-card-logo" src={sel.logo} alt={`${sel.name} logo`} />
            ) : (
              <span className="radar-card-logo radar-card-logo-fallback" aria-hidden>{sel.name.charAt(0).toUpperCase()}</span>
            )}
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 17, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {sel.name}
                {sel.verified && <VerifiedTick size={16} />}
              </strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span className="badge">{categoryEmoji(sel.category)} {sel.category}</span>
                {sel.isDropshipper && <span className="badge badge-dropship">🚚 Dropshipper</span>}
                <span className={`badge ${sel.open ? 'badge-success' : ''}`}>
                  {sel.open ? 'Open now' : sel.hours ? 'Closed today' : 'Hours not set'}
                </span>
              </div>
            </div>
            <button type="button" className="radar-card-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          </div>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
            {sel.address ?? 'Address on the store page'}
            {sel.hoursToday ? ` · Today ${sel.hoursToday}` : ''}
          </p>
          <div className="radar-card-stats">
            <span><strong>{formatDistance(sel.km)}</strong><em className="muted">away</em></span>
            <span>
              <strong>🚶 {route ? `${formatDistance(route.km)} · ${route.min} min` : travelEstimates(sel.km).walk}</strong>
              <em className="muted">{route ? (route.real ? 'walk route' : 'walk (direct)') : 'walk'}</em>
            </span>
            <span><strong>🚗 {travelEstimates(sel.km).drive}</strong><em className="muted">drive</em></span>
            {sel.rating != null && sel.reviewCount ? (
              <span><strong>⭐ {sel.rating.toFixed(1)}</strong><em className="muted">{sel.reviewCount} review{sel.reviewCount === 1 ? '' : 's'}</em></span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Link className="btn btn-primary btn-sm" href={`/s/${sel.slug}`}>Visit store</Link>
            <a
              className="btn btn-outline btn-sm"
              href={directionsUrl(origin, { lat: sel.lat, lng: sel.lng }, sel.name)}
              target="_blank"
              rel="noreferrer"
            >
              How to get there ↗
            </a>
          </div>
        </div>
      )}

      {state === 'ready' && (
        <p className="muted radar-hint">
          Centred on <strong>{label ?? 'your location'}</strong> — click a pin to see the store, the walking route and how to get there.
        </p>
      )}
    </section>
  );
}

function categoriesOf(stores: MapStore[]): string[] {
  return Array.from(new Set(stores.map((s) => s.category)));
}
