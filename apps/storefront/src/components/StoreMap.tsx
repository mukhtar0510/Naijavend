'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
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

/** A fetched route (OSRM) or the straight-line fallback. */
interface RouteInfo {
  km: number;
  min: number;
  real: boolean; // false → haversine fallback line
  profile: 'foot' | 'driving';
}

/**
 * Street-level map tab (OpenStreetMap tiles — real roads, buildings and
 * landmarks). The viewer is a pulsing blue dot; every store is a bubble pin
 * with an open-now dot. Advanced layout: map and a synced side list sit
 * side-by-side on desktop (stacked on phones) — clicking either selects the
 * store, draws the route on the map and shows the detail card.
 */
export function StoreMap({ stores }: { stores: MapStore[] }) {
  const { origin, label, state, locate, pickCity, reset } = useViewerLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [profile, setProfile] = useState<'foot' | 'driving'>('foot');
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const userRef = useRef<LayerGroup | null>(null);
  const routeRef = useRef<LayerGroup | null>(null);
  // slug → marker, so selecting from the list can highlight + open the pin.
  const markerBySlugRef = useRef<Map<string, Marker>>(new Map());
  // origin+store+profile → route; avoids refetching OSRM while panning between pins.
  const routeCacheRef = useRef<Map<string, RouteInfo>>(new Map());
  // Track the previously selected pin so we can drop its raised z-index.
  const prevSelectedRef = useRef<string | null>(null);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  const periodLabel = profile === 'foot' ? 'walk' : 'drive';
  const travelSec = (s: { lat: number; lng: number }, km: number) =>
    Math.max(1, Math.round((km / (profile === 'foot' ? 4.8 : 22)) * 60));

  const plotted = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return stores
      .filter((s) => (cat ? s.category === cat : true))
      .filter((s) => (ql ? s.name.toLowerCase().includes(ql) || (s.address ?? '').toLowerCase().includes(ql) : true))
      .map((s) => ({
        ...s,
        km: origin ? haversineKm(origin, { lat: s.lat, lng: s.lng }) : null,
        open: isOpenNow(s.hours),
        hoursToday: todayHoursLabel(s.hours),
      }))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  }, [stores, cat, origin, query]);

  const sel = plotted.find((p) => p.slug === selected) ?? null;

  // Selecting a store from the list highlights its pin, pans the map and keeps
  // the list entry in view — one state drives both sides of the split view.
  function select(slug: string | null) {
    setSelected(slug);
  }

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
        zoomControl: true, // explicit +/- now that tiles are OSM (small, unobtrusive)
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
        routeRef.current = null;
        markerBySlugRef.current.clear();
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
      markerBySlugRef.current.clear();

      for (const s of plotted) {
        const logo = s.logo ? `<img src="${s.logo.replace(/"/g, '%22')}" alt="" />` : categoryEmoji(s.category);
        const html = `<span class="map-pin">${logo}<i data-open="${s.open ? '1' : '0'}"></i></span>`;
        const marker = L.marker([s.lat, s.lng], {
          icon: L.divIcon({ className: 'map-pin-wrap', html, iconSize: [44, 44], iconAnchor: [22, 22] }),
          title: `${s.name}${s.km != null ? ` · ${formatDistance(s.km)}` : ''}`,
          riseOnHover: true,
        })
          .addTo(group)
          .on('click', function (this: Marker) {
            // Overlapping pins: lift the clicked one above its neighbours so the
            // next click in a stack targets a different pin.
            this.setZIndexOffset(1000);
            setSelected(s.slug);
          });
        markerBySlugRef.current.set(s.slug, marker);
      }

      const pts = plotted.map((p) => [p.lat, p.lng] as [number, number]);
      if (origin) pts.push([origin.lat, origin.lng]);
      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 14);
      }
      // Restore selection highlight after a filter re-render.
      const selNow = selectedRef.current;
      if (selNow) markerBySlugRef.current.get(selNow)?.setZIndexOffset(1000);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, plotted, origin]);

  // Selected pin highlight — raise the new one, un-raise the old one, and pan
  // the map so the selection stays visible even when picked from the list.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const prev = prevSelectedRef.current;
    if (prev && prev !== selected) markerBySlugRef.current.get(prev)?.setZIndexOffset(0);
    if (selected) {
      const marker = markerBySlugRef.current.get(selected);
      if (marker) {
        marker.setZIndexOffset(1000);
        map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
      }
    }
    prevSelectedRef.current = selected;
  }, [selected, ready]);

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

  // Route from the viewer to the selected store — real foot/drive path via the
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

      const key = `${profile}|${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${sel.slug}`;
      const cached = routeCacheRef.current.get(key);
      if (cached) {
        routeRef.current?.remove();
        routeRef.current = null;
        setRoute(cached);
        return;
      }

      routeRef.current?.remove();
      routeRef.current = null;
      setRoute(null);

      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const color = profile === 'foot' ? (dark ? '#60A5FA' : '#1D4ED8') : dark ? '#34D399' : '#059669';
      const line = (coords: [number, number][], dashed: boolean) =>
        L.polyline(coords, {
          color,
          weight: 4,
          opacity: 0.85,
          dashArray: dashed ? '6 8' : undefined,
          lineCap: 'round',
        });

      let drawn: RouteInfo | null = null;
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${sel.lng},${sel.lat}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(6000) },
        );
        const body = await res.json();
        const r = body?.routes?.[0];
        if (res.ok && r?.geometry?.coordinates?.length > 1) {
          const coords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          const km = r.distance / 1000;
          const min = Math.max(1, Math.round(r.duration / 60));
          drawn = { km, min, real: true, profile };
          routeRef.current = L.layerGroup([line(coords, false)]).addTo(map);
          map.fitBounds(L.latLngBounds(coords).pad(0.2), { maxZoom: 16 });
        }
      } catch {
        // OSRM unreachable / timeout — fall through to the straight line.
      }
      if (!drawn && !cancelled) {
        const km = sel.km ?? 0;
        drawn = { km, min: travelSec(sel, km), real: false, profile };
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
  }, [ready, sel, origin, profile]);

  // Fullscreen mode: lock the page behind the expanded map and put Escape on
  // the close button so keyboard users aren't trapped.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  function recenter() {
    const map = mapRef.current;
    if (!map) return;
    if (origin) map.flyTo([origin.lat, origin.lng], 13, { duration: 0.8 });
    else locate();
  }

  return (
    <section className={`storemap${fullscreen ? ' storemap-fs' : ''}`} aria-label="Street map of stores">
      <div className="radar-head">
        <h2>🗺️ Map view {origin ? '' : ''}<span className="map-count">{plotted.length}</span></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={recenter} title="Centre on my location">
            ⌖ Me
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
          >
            {fullscreen ? '⤡ Exit' : '⛶ Full'}
          </button>
          {state === 'ready' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
              Change
            </button>
          )}
        </div>
      </div>

      {categoriesOf(plotted).length > 1 && (
        <div className="radar-cats" role="group" aria-label="Filter map by category">
          <button type="button" className={`radar-cat${cat === null ? ' on' : ''}`} onClick={() => { setCat(null); setSelected(null); }}>
            All
          </button>
          {categoriesOf(plotted).map((c) => (
            <button key={c} type="button" className={`radar-cat${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setSelected(null); }}>
              {categoryEmoji(c)} {c}
            </button>
          ))}
          <input
            type="search"
            className="map-search"
            placeholder="Filter by name or area…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter map stores"
          />
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

      <div className="map-split">
        <div className="map-frame">
          <div ref={containerRef} className="map-canvas" role="application" aria-label="Interactive map of stores" />
          <div className="map-legend" aria-hidden="true">
            <span><i className="lg-open" /> open now</span>
            <span><i className="lg-closed" /> closed</span>
            <span><i className="lg-pin" /> store pin</span>
          </div>
        </div>

        <aside className="map-list" aria-label="Stores on the map">
          {plotted.length === 0 && <div className="muted map-list-empty">No stores match your filters.</div>}
          {plotted.slice(0, 30).map((s) => (
            <button
              key={s.slug}
              type="button"
              className={`map-row${selected === s.slug ? ' on' : ''}`}
              onClick={() => select(s.slug)}
            >
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                <img className="map-row-logo" src={s.logo} alt="" loading="lazy" />
              ) : (
                <span className="map-row-logo map-row-logo-fallback" aria-hidden>{categoryEmoji(s.category)}</span>
              )}
              <span className="map-row-body">
                <strong>
                  {s.name}
                  {s.verified && <VerifiedTick size={13} />}
                </strong>
                <em className="muted">{s.address ?? s.category}</em>
              </span>
              <span className="map-row-side">
                <i className={`map-row-dot${s.open ? ' open' : ''}`} title={s.open ? 'Open now' : 'Closed'} />
                {s.km != null && <strong className="map-row-km">{formatDistance(s.km)}</strong>}
                <em className="muted map-row-eta">{periodLabel === 'walk' ? travelEstimates(s.km ?? 0).walk : travelEstimates(s.km ?? 0).drive}</em>
              </span>
            </button>
          ))}
        </aside>
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
              <strong>
                {profile === 'foot' ? '🚶' : '🚗'} {route ? `${formatDistance(route.km)} · ${route.min} min` : travelEstimates(sel.km).walk}
              </strong>
              <em className="muted">
                {route ? (route.real ? `${periodLabel} route` : `${periodLabel} (direct)`) : `${periodLabel} (est.)`}
              </em>
            </span>
            <span>
              <strong>{profile === 'foot' ? `🚗 ${travelEstimates(sel.km).drive}` : `🚶 ${travelEstimates(sel.km).walk}`}</strong>
              <em className="muted">{profile === 'foot' ? 'drive' : 'walk'} (est.)</em>
            </span>
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
            <div className="map-profile-toggle" role="group" aria-label="Route mode">
              <button
                type="button"
                className={`map-profile-btn${profile === 'foot' ? ' on' : ''}`}
                onClick={() => setProfile('foot')}
              >
                🚶 Walk
              </button>
              <button
                type="button"
                className={`map-profile-btn${profile === 'driving' ? ' on' : ''}`}
                onClick={() => setProfile('driving')}
              >
                🚗 Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {state === 'ready' && (
        <p className="muted radar-hint">
          Centred on <strong>{label ?? 'your location'}</strong> — click a pin or a side-list row to see the store, the {periodLabel} route and how to get there.
        </p>
      )}
    </section>
  );
}

function categoriesOf(stores: MapStore[]): string[] {
  return Array.from(new Set(stores.map((s) => s.category)));
}
