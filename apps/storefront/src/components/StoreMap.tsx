'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import {
  ArrowUpRight,
  Car,
  Crosshair,
  Footprints,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Search,
  Star,
  X,
} from 'lucide-react';
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
 * with an open-now dot. Desktop is a map + synced side panel; phones stack the
 * panel under the map. Selecting a store from either side draws the route and
 * opens the detail card.
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

  const cats = categoriesOf(stores);
  const located = state === 'ready';

  return (
    <section className={`nv-map${fullscreen ? ' is-fullscreen' : ''}`} aria-label="Street map of stores">
      {/* -------------------------------- header -------------------------------- */}
      <div className="nv-map-head">
        <div className="nv-map-head-id">
          <span className="nv-map-head-ico" aria-hidden>
            <MapPin size={18} />
          </span>
          <div>
            <h2>Map view</h2>
            <p>
              {plotted.length} store{plotted.length === 1 ? '' : 's'}
              {label ? ` around ${label}` : ' across the marketplace'}
              {!located ? ' · turn on location for distances' : ''}
            </p>
          </div>
        </div>
        <div className="nv-map-head-actions">
          <button type="button" className="nv-map-btn" onClick={recenter} title="Centre on my location">
            <Crosshair size={15} aria-hidden />
            <span>Me</span>
          </button>
          <button
            type="button"
            className="nv-map-btn"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
          >
            {fullscreen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
            <span>{fullscreen ? 'Exit' : 'Full'}</span>
          </button>
          {located && (
            <button type="button" className="nv-map-btn" onClick={reset}>
              Change area
            </button>
          )}
        </div>
      </div>

      {/* --------------------------- location prompts --------------------------- */}
      {state === 'idle' && (
        <div className="nv-map-banner">
          <LocateFixed size={18} aria-hidden />
          <div>
            <strong>See real distances and routes</strong>
            <p>Share your location once — it stays in this browser, never on our servers.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={locate}>
            Use my location
          </button>
          <div className="nv-map-banner-cities">
            {QUICK_CITIES.map((c) => (
              <button key={c.label} type="button" className="nv-map-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {state === 'locating' && (
        <div className="nv-map-banner">
          <LocateFixed size={18} aria-hidden className="nv-spin" />
          <div>
            <strong>Locating you…</strong>
            <p>This only takes a moment.</p>
          </div>
        </div>
      )}
      {state === 'denied' && (
        <div className="nv-map-banner">
          <MapPin size={18} aria-hidden />
          <div>
            <strong>Location is blocked — that&apos;s fine</strong>
            <p>Pick a base area to centre the map and unlock distances.</p>
          </div>
          <div className="nv-map-banner-cities">
            {QUICK_CITIES.map((c) => (
              <button key={c.label} type="button" className="nv-map-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="nv-map-banner">
          <MapPin size={18} aria-hidden />
          <div>
            <strong>This browser can&apos;t share location</strong>
            <p>Pick a base area and every store still sorts by distance from it.</p>
          </div>
          <div className="nv-map-banner-cities">
            {QUICK_CITIES.map((c) => (
              <button key={c.label} type="button" className="nv-map-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------- filters ------------------------------- */}
      <div className="nv-map-filters">
        <label className="nv-map-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder="Filter by name or area…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter map stores by name or area"
          />
        </label>
        <div className="nv-map-cats" role="group" aria-label="Filter map by category">
          <button
            type="button"
            className={`nv-map-cat${cat === null ? ' is-active' : ''}`}
            onClick={() => {
              setCat(null);
              setSelected(null);
            }}
          >
            All
          </button>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={`nv-map-cat${cat === c ? ' is-active' : ''}`}
              onClick={() => {
                setCat(c);
                setSelected(null);
              }}
            >
              <span aria-hidden>{categoryEmoji(c)}</span>
              {c.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* --------------------------------- split -------------------------------- */}
      <div className="nv-map-layout">
        <div className="nv-map-stage">
          <div ref={containerRef} className="map-canvas nv-map-canvas" role="application" aria-label="Interactive map of stores" />
          <div className="nv-map-legend" aria-hidden>
            <span>
              <i className="is-open" /> open now
            </span>
            <span>
              <i className="is-closed" /> closed
            </span>
            <span>
              <i className="is-pin" /> store
            </span>
          </div>
          {plotted.length === 0 && (
            <div className="nv-map-overlay">
              <strong>No stores match those filters</strong>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setCat(null);
                  setQuery('');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <aside className="nv-map-panel" aria-label="Stores on the map">
          <div className="nv-map-panel-head">
            <strong>On the map</strong>
            <span>{plotted.length}</span>
          </div>
          <div className="nv-map-list">
            {plotted.slice(0, 40).map((s) => (
              <button
                key={s.slug}
                type="button"
                className={`nv-map-store${selected === s.slug ? ' is-active' : ''}`}
                onClick={() => select(s.slug)}
              >
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                  <img className="nv-map-store-logo" src={s.logo} alt="" loading="lazy" />
                ) : (
                  <span className="nv-map-store-logo is-fallback" aria-hidden>
                    {categoryEmoji(s.category)}
                  </span>
                )}
                <span className="nv-map-store-body">
                  <strong>
                    {s.name}
                    {s.verified && <VerifiedTick size={13} />}
                  </strong>
                  <em>{s.address ?? s.category.replace(/-/g, ' ')}</em>
                  <span className="nv-map-store-meta">
                    <i className={`nv-map-dot${s.open ? ' is-open' : ''}`} />
                    {s.open ? 'Open now' : 'Closed'}
                    {s.km != null && <> · {formatDistance(s.km)}</>}
                  </span>
                </span>
                <ArrowUpRight size={15} className="nv-map-store-go" aria-hidden />
              </button>
            ))}
            {plotted.length === 0 && <p className="nv-map-empty">Nothing here yet.</p>}
          </div>
        </aside>
      </div>

      {/* -------------------------------- detail -------------------------------- */}
      {sel && (
        <div className="nv-map-detail">
          <div className="nv-map-detail-id">
            {sel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
              <img className="nv-map-detail-logo" src={sel.logo} alt={`${sel.name} logo`} />
            ) : (
              <span className="nv-map-detail-logo is-fallback" aria-hidden>
                {sel.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <strong>
                {sel.name}
                {sel.verified && <VerifiedTick size={15} />}
              </strong>
              <p>
                {categoryEmoji(sel.category)} {sel.category.replace(/-/g, ' ')}
                {sel.isDropshipper ? ' · 🚚 dropshipper' : ''}
                {sel.hoursToday ? ` · today ${sel.hoursToday}` : ''}
              </p>
            </div>
            <button type="button" className="nv-map-detail-close" onClick={() => select(null)} aria-label="Close details">
              <X size={17} />
            </button>
          </div>

          <div className="nv-map-detail-stats">
            <span>
              <strong>{sel.km != null ? formatDistance(sel.km) : '—'}</strong>
              <em>away</em>
            </span>
            <span>
              <strong>
                {profile === 'foot' ? <Footprints size={14} /> : <Car size={14} />}{' '}
                {route ? `${formatDistance(route.km)} · ${route.min} min` : sel.km != null ? (profile === 'foot' ? travelEstimates(sel.km).walk : travelEstimates(sel.km).drive) : '—'}
              </strong>
              <em>{route ? (route.real ? `${periodLabel} route` : `${periodLabel} direct`) : `${periodLabel} estimate`}</em>
            </span>
            <span>
              <strong>{sel.open ? 'Open now' : sel.hours ? 'Closed today' : 'Hours not set'}</strong>
              <em>{sel.address ?? 'Address on the store page'}</em>
            </span>
            {sel.rating != null && sel.reviewCount ? (
              <span>
                <strong>
                  <Star size={13} /> {sel.rating.toFixed(1)}
                </strong>
                <em>
                  {sel.reviewCount} review{sel.reviewCount === 1 ? '' : 's'}
                </em>
              </span>
            ) : null}
          </div>

          <div className="nv-map-detail-actions">
            <Link className="btn btn-primary btn-sm" href={`/s/${sel.slug}`}>
              Visit store
            </Link>
            {origin && (
              <a
                className="btn btn-outline btn-sm"
                href={directionsUrl(origin, { lat: sel.lat, lng: sel.lng }, sel.name)}
                target="_blank"
                rel="noreferrer"
              >
                Directions <ArrowUpRight size={14} />
              </a>
            )}
            <div className="nv-map-toggle" role="group" aria-label="Route mode">
              <button
                type="button"
                className={`nv-map-toggle-btn${profile === 'foot' ? ' is-active' : ''}`}
                onClick={() => setProfile('foot')}
              >
                <Footprints size={14} /> Walk
              </button>
              <button
                type="button"
                className={`nv-map-toggle-btn${profile === 'driving' ? ' is-active' : ''}`}
                onClick={() => setProfile('driving')}
              >
                <Car size={14} /> Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {located && (
        <p className="nv-map-hint">
          Centred on <strong>{label ?? 'your location'}</strong> — tap a pin or a store in the list to
          see the {periodLabel} route.
        </p>
      )}
    </section>
  );
}

function categoriesOf(stores: MapStore[]): string[] {
  return Array.from(new Set(stores.map((s) => s.category)));
}
