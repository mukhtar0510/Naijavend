'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Marker, Popup } from 'maplibre-gl';
import {
  ArrowUpRight,
  Bike,
  Car,
  Check,
  Crosshair,
  Expand,
  Footprints,
  Layers,
  List,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Search,
  Share2,
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
  } from '@idevtenancy/shared';
import { QUICK_CITIES, useViewerLocation } from '@/lib/useViewerLocation';
import { circlePolygon, createThemedMap, ll, type BaseLayerId, type ThemedMap } from '@/lib/mapFactory';
import { VerifiedTick } from '@/components/VerifiedTick';
import { ExampleTag } from '@/components/ExampleStoreBanner';
import { ILORIN_BOUNDS, ILORIN_CENTER, ILORIN_MIN_ZOOM, inIlorin } from '@/lib/ilorin';
import { CategoryIcon, categoryColor } from '@/lib/categories';

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
  /** Sample-data store (labelled; cannot take orders). */
  isExample?: boolean;
  rating: number | null;
  reviewCount: number | null;
  hours: Record<string, [string, string] | null | undefined> | null;
}

// Ilorin-only: centred on the city, panning held to the metro area, and only
// stores inside it are plotted (see lib/ilorin).

type Profile = 'foot' | 'bike' | 'driving';
type SortKey = 'near' | 'rating' | 'name';

const PROFILES: Record<Profile, { label: string; verb: string; kmh: number; router: string }> = {
  foot: { label: 'Walk', verb: 'walk', kmh: 4.8, router: 'routed-foot' },
  bike: { label: 'Okada', verb: 'ride', kmh: 18, router: 'routed-bike' },
  driving: { label: 'Drive', verb: 'drive', kmh: 22, router: 'routed-car' },
};
const RADII = [1, 3, 5, 10] as const;
/** Pins closer than this (screen px) merge into a cluster bubble. */
const CLUSTER_PX = 52;
/** At or above this zoom every store gets its own pin. */
const CLUSTER_OFF_ZOOM = 16;

interface RouteStep {
  text: string;
  m: number;
}
/** A fetched road route (FOSSGIS OSRM) or the straight-line fallback. */
interface RouteInfo {
  km: number;
  min: number;
  real: boolean; // false → haversine fallback line
  profile: Profile;
  coords: [number, number][];
  steps: RouteStep[];
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

type Plotted = MapStore & { km: number | null; open: boolean; hoursToday: string | null };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Street-level store locator (MapLibre GL: OpenFreeMap vector tiles, Esri
 * satellite imagery). The viewer
 * is a pulsing blue dot; stores are logo pins with an open-now dot that merge
 * into count bubbles when zoomed out. Desktop is map + synced side panel;
 * phones stack the panel under the map. Selecting a store draws a real road
 * route (walk / okada / drive) with turn-by-turn steps. The selection lives in
 * the URL (?store=slug) so a map view can be shared.
 */
export function StoreMap({ stores }: { stores: MapStore[] }) {
  const { origin, label, state, locate, pickCity, reset } = useViewerLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [profile, setProfile] = useState<Profile>('foot');
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('near');
  const [inViewOnly, setInViewOnly] = useState(false);
  const [viewBounds, setViewBounds] = useState<[number, number, number, number] | null>(null); // s,w,n,e
  const [zoom, setZoom] = useState(12);
  const [base, setBase] = useState<BaseLayerId>('streets');
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<ThemedMap | null>(null);
  const initRef = useRef<Promise<ThemedMap> | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // slug → marker for stores currently drawn as their own pin (not clustered).
  const markerBySlugRef = useRef<Map<string, Marker>>(new Map());
  // profile+origin+store → route; avoids refetching while hopping between pins.
  const routeCacheRef = useRef<Map<string, RouteInfo>>(new Map());
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;
  const hoveredRef = useRef<string | null>(null);
  hoveredRef.current = hovered;
  const listRef = useRef<HTMLDivElement | null>(null);
  // Hidden sprite of category icons; pins (plain HTML) copy their SVG from it.
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const pinIconSvg = (category: string) =>
    spriteRef.current?.querySelector(`[data-cat="${CSS.escape(category)}"]`)?.innerHTML ?? '';

  const prof = PROFILES[profile];

  // ------------------------------------------------------------------ data
  const ilorinStores = useMemo(() => stores.filter((s) => inIlorin(s.lat, s.lng)), [stores]);
  const plotted: Plotted[] = useMemo(() => {
    const ql = query.trim().toLowerCase();
    const rows = ilorinStores
      .filter((s) => (cat ? s.category === cat : true))
      .filter((s) =>
        ql
          ? s.name.toLowerCase().includes(ql) ||
            (s.address ?? '').toLowerCase().includes(ql) ||
            s.category.replace(/-/g, ' ').includes(ql)
          : true,
      )
      .filter((s) => (verifiedOnly ? s.verified : true))
      .filter((s) => (topRated ? (s.rating ?? 0) >= 4 && (s.reviewCount ?? 0) > 0 : true))
      .map((s) => ({
        ...s,
        km: origin ? haversineKm(origin, { lat: s.lat, lng: s.lng }) : null,
        open: isOpenNow(s.hours),
        hoursToday: todayHoursLabel(s.hours),
      }))
      .filter((s) => (openOnly ? s.open : true))
      .filter((s) => (radiusKm != null && s.km != null ? s.km <= radiusKm : true));
    const byName = (a: Plotted, b: Plotted) => a.name.localeCompare(b.name);
    if (sort === 'name') rows.sort(byName);
    else if (sort === 'rating')
      rows.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    else rows.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || byName(a, b));
    return rows;
  }, [ilorinStores, cat, origin, query, openOnly, verifiedOnly, topRated, radiusKm, sort]);

  // The side list optionally follows the map viewport ("search this area").
  const listed = useMemo(() => {
    if (!inViewOnly || !viewBounds) return plotted;
    const [s, w, n, e] = viewBounds;
    return plotted.filter((p) => p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e);
  }, [plotted, inViewOnly, viewBounds]);

  // A selection survives filters that hide it (e.g. "Open now" toggled on).
  const hidden = plotted.some((p) => p.slug === selected) ? null : ilorinStores.find((s) => s.slug === selected) ?? null;
  const selPlotted: Plotted | null =
    plotted.find((p) => p.slug === selected) ??
    (hidden
      ? { ...hidden, km: origin ? haversineKm(origin, hidden) : null, open: isOpenNow(hidden.hours), hoursToday: todayHoursLabel(hidden.hours) }
      : null);
  const openCount = plotted.filter((p) => p.open).length;
  const activeFilterCount =
    (cat ? 1 : 0) + (query.trim() ? 1 : 0) + (openOnly ? 1 : 0) + (verifiedOnly ? 1 : 0) + (topRated ? 1 : 0) + (radiusKm ? 1 : 0);

  const clearFilters = () => {
    setCat(null);
    setQuery('');
    setOpenOnly(false);
    setVerifiedOnly(false);
    setTopRated(false);
    setRadiusKm(null);
  };

  // ------------------------------------------------------------ URL state
  // ?store=slug opens that store on load and is kept in sync (shareable).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('store');
    if (slug && ilorinStores.some((s) => s.slug === slug)) setSelected(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set('store', selected);
    else url.searchParams.delete('store');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [selected]);

  // ------------------------------------------------------------- map init
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      // Share one in-flight init: React's dev double-mount would otherwise
      // start two maps on the same container.
      initRef.current ??= createThemedMap(containerRef.current, {
        center: ILORIN_CENTER,
        zoom: 12,
        scrollWheelZoom: false, // don't hijack page scroll; double-click/pinch zooms
        zoomControl: true,
        maxBounds: ILORIN_BOUNDS,
        minZoom: ILORIN_MIN_ZOOM,
      });
      const [map, lib] = await Promise.all([initRef.current, import('maplibre-gl')]);
      // A cancelled run leaves the map for the remount that awaits the same promise.
      if (cancelled) return;
      libRef.current = lib;
      mapRef.current = map;

      // Overlay layers live above the basemap (and satellite) but under the
      // DOM pins. Route: white casing + solid road line, or dashed fallback.
      if (!map.getSource('nv-radius')) {
        map.addSource('nv-radius', { type: 'geojson', data: EMPTY_FC });
        map.addLayer({ id: 'nv-radius-fill', type: 'fill', source: 'nv-radius', paint: { 'fill-color': '#1D4ED8', 'fill-opacity': 0.07 } });
        map.addLayer({
          id: 'nv-radius-line',
          type: 'line',
          source: 'nv-radius',
          paint: { 'line-color': '#1D4ED8', 'line-width': 2, 'line-dasharray': [2, 2] },
        });
        map.addSource('nv-route', { type: 'geojson', data: EMPTY_FC });
        map.addLayer({
          id: 'nv-route-casing',
          type: 'line',
          source: 'nv-route',
          filter: ['==', ['get', 'real'], true],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: 'nv-route-line',
          type: 'line',
          source: 'nv-route',
          filter: ['==', ['get', 'real'], true],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#1D4ED8', 'line-width': 5, 'line-opacity': 0.92 },
        });
        map.addLayer({
          id: 'nv-route-dash',
          type: 'line',
          source: 'nv-route',
          filter: ['==', ['get', 'real'], false],
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': '#1D4ED8', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 2] },
        });
      }

      const syncView = () => {
        const b = map.getBounds();
        setViewBounds([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
        // Half-zoom buckets: re-cluster on real zoom changes, not every frame.
        setZoom(Math.round(map.getZoom() * 2) / 2);
      };
      map.on('moveend', syncView);
      // Wheel-zoom only once the user has clicked into the map.
      const container = map.getContainer();
      const enableWheel = () => map.scrollZoom.enable();
      const disableWheel = () => map.scrollZoom.disable();
      map.on('click', enableWheel);
      container.addEventListener('mouseleave', disableWheel);
      syncView();
      cleanup = () => {
        container.removeEventListener('mouseleave', disableWheel);
        for (const m of markersRef.current) m.remove();
        markersRef.current = [];
        userRef.current?.remove();
        userRef.current = null;
        popupRef.current?.remove();
        popupRef.current = null;
        markerBySlugRef.current.clear();
        map.remove();
        initRef.current = null;
        mapRef.current = null;
      };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // MapLibre tracks container resizes itself; nudge it after the fullscreen
  // transition so the canvas matches the final size immediately.
  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.resize(), 60);
    return () => window.clearTimeout(t);
  }, [fullscreen]);

  useEffect(() => {
    mapRef.current?.setBaseLayer(base);
  }, [base, ready]);

  // ------------------------------------------------- pins + clustering
  const paintHighlights = useCallback(() => {
    for (const [slug, m] of markerBySlugRef.current) {
      const on = slug === selectedRef.current || slug === hoveredRef.current;
      const el = m.getElement();
      el.classList.toggle('map-pin-hl', on);
      el.style.zIndex = slug === selectedRef.current ? '30' : on ? '20' : '';
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    markerBySlugRef.current.clear();
    const tip = (popupRef.current ??= new lib.Popup({ closeButton: false, closeOnClick: false, offset: 26, className: 'map-tip' }));
    tip.remove();

    // Greedy screen-space clustering at the current zoom. The selected store
    // is always drawn on its own so its route endpoint stays visible.
    const z = map.getZoom();
    type Bucket = { items: Plotted[]; x: number; y: number };
    const buckets: Bucket[] = [];
    const solo: Plotted[] = [];
    for (const s of plotted) {
      if (z >= CLUSTER_OFF_ZOOM || s.slug === selectedRef.current) {
        solo.push(s);
        continue;
      }
      const p = map.project(ll(s.lat, s.lng));
      const hit = buckets.find((b) => Math.abs(b.x - p.x) < CLUSTER_PX && Math.abs(b.y - p.y) < CLUSTER_PX);
      if (hit) hit.items.push(s);
      else buckets.push({ items: [s], x: p.x, y: p.y });
    }

    const add = (el: HTMLElement, lat: number, lng: number) => {
      const m = new lib.Marker({ element: el, anchor: 'center' }).setLngLat(ll(lat, lng)).addTo(map);
      markersRef.current.push(m);
      return m;
    };

    for (const b of buckets) {
      if (b.items.length === 1) {
        solo.push(b.items[0]);
        continue;
      }
      const open = b.items.filter((i) => i.open).length;
      const n = b.items.length;
      const size = n < 10 ? 40 : n < 50 ? 48 : 56;
      const lat = b.items.reduce((a, i) => a + i.lat, 0) / n;
      const lng = b.items.reduce((a, i) => a + i.lng, 0) / n;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin-wrap';
      el.title = `${n} stores here — click to zoom in`;
      el.setAttribute('aria-label', `${n} stores here, zoom in`);
      el.innerHTML = `<span class="map-cluster" style="width:${size}px;height:${size}px">${n}${open ? `<i>${open} open</i>` : ''}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const bounds = new lib.LngLatBounds();
        for (const i of b.items) bounds.extend(ll(i.lat, i.lng));
        map.fitBounds(bounds, { padding: 70, maxZoom: CLUSTER_OFF_ZOOM, duration: 600 });
      });
      add(el, lat, lng);
    }

    for (const s of solo) {
      // No emoji pins: the store logo, else its category icon (SVG from the hidden sprite).
      const logo = s.logo ? `<img src="${esc(s.logo)}" alt="" />` : pinIconSvg(s.category);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin-wrap';
      el.setAttribute('aria-label', `${s.name}${s.km != null ? `, ${formatDistance(s.km)} away` : ''}`);
      el.innerHTML = `<span class="map-pin" style="--pin-ring:${categoryColor(s.category)}">${logo}<i data-open="${s.open ? '1' : '0'}"></i>${
        s.verified ? '<b class="map-pin-tick" aria-hidden="true">✓</b>' : ''
      }</span>`;
      const tipHtml = `<strong>${esc(s.name)}</strong>${s.isExample ? ' <em class="map-tip-ex">Example</em>' : ''}<br/><span>${s.open ? 'Open now' : 'Closed'}${
        s.km != null ? ` · ${formatDistance(s.km)}` : ''
      }${s.rating != null && s.reviewCount ? ` · ★ ${s.rating.toFixed(1)}` : ''}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(s.slug);
      });
      el.addEventListener('mouseenter', () => {
        setHovered(s.slug);
        tip.setLngLat(ll(s.lat, s.lng)).setHTML(tipHtml).addTo(map);
      });
      el.addEventListener('mouseleave', () => {
        setHovered((h) => (h === s.slug ? null : h));
        tip.remove();
      });
      markerBySlugRef.current.set(s.slug, add(el, s.lat, s.lng));
    }
    paintHighlights();
    // zoom re-clusters; selected keeps the chosen store out of clusters.
  }, [ready, plotted, zoom, selected, paintHighlights]);

  useEffect(() => {
    paintHighlights();
    if (!hovered || !listRef.current) return;
    // Hovering a pin scrolls its row into view inside the side panel only
    // (scrollIntoView would also yank the page).
    const list = listRef.current;
    const row = list.querySelector<HTMLElement>(`[data-slug="${CSS.escape(hovered)}"]`);
    if (!row) return;
    const top = row.offsetTop; // .nv-map-list is position: relative
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 2 + row.offsetHeight / 2, behavior: 'smooth' });
    }
  }, [hovered, paintHighlights]);

  // Fit the map to the result set whenever the *set* changes (not on sort or
  // when the user is browsing by viewport, which would fight their panning).
  const fitKey = useMemo(
    () =>
      plotted
        .map((p) => p.slug)
        .sort()
        .join('|') + `#${radiusKm ?? ''}#${origin ? `${origin.lat},${origin.lng}` : ''}`,
    [plotted, radiusKm, origin],
  );
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const bounds = new lib.LngLatBounds();
    if (radiusKm && origin) {
      for (const c of circlePolygon(origin.lat, origin.lng, radiusKm, 24).geometry.coordinates[0]) bounds.extend(c as [number, number]);
      map.fitBounds(bounds, { padding: 24, duration: 600 });
      return;
    }
    const pts = plotted.map((p) => ll(p.lat, p.lng));
    if (origin) pts.push(ll(origin.lat, origin.lng));
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 15, duration: 600 });
      return;
    }
    if (!pts.length) return;
    for (const p of pts) bounds.extend(p);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitKey captures the inputs
  }, [fitKey]);
  useEffect(() => {
    if (!ready || inViewOnly || selectedRef.current) return;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the set changes
  }, [ready, fitKey]);

  // Pan to a store picked from the list (pins clicked are already in view).
  useEffect(() => {
    if (!ready || !selPlotted) return;
    const map = mapRef.current;
    if (!map) return;
    const target = ll(selPlotted.lat, selPlotted.lng);
    const p = map.project(target);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    if (p.x < w * 0.1 || p.x > w * 0.9 || p.y < h * 0.1 || p.y > h * 0.9) {
      map.flyTo({ center: target, zoom: Math.max(map.getZoom(), 15), duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on selection change
  }, [selected, ready]);

  // ----------------------------------------------- viewer dot + radius
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    userRef.current?.remove();
    userRef.current = null;
    (map.getSource('nv-radius') as GeoJSONSource | undefined)?.setData(
      origin && radiusKm ? circlePolygon(origin.lat, origin.lng, radiusKm) : EMPTY_FC,
    );
    if (!origin) return;
    const el = document.createElement('span');
    el.className = 'map-me-wrap';
    el.innerHTML = '<span class="map-me"><i></i></span>';
    el.style.zIndex = '40';
    el.style.pointerEvents = 'none';
    userRef.current = new lib.Marker({ element: el, anchor: 'center' }).setLngLat(ll(origin.lat, origin.lng)).addTo(map);
  }, [ready, origin, radiusKm]);

  // --------------------------------------------------------------- route
  // Real foot / bike / car path from the FOSSGIS OSRM servers (the public
  // project-osrm demo only routes cars, so "walk" there was really a car
  // route). Dashed straight line as the fallback. Cached per pair.
  const selLat = selPlotted?.lat;
  const selLng = selPlotted?.lng;
  const selKm = selPlotted?.km ?? null;
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const lib = libRef.current;
    const src = map?.getSource('nv-route') as GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
    if (!map || !lib || !src || selected == null || selLat == null || selLng == null || !origin) {
      setRoute(null);
      setRouting(false);
      return;
    }
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, 8000);
    const stale = () => ctrl.signal.aborted && !timedOut;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = { foot: dark ? '#60A5FA' : '#1D4ED8', bike: dark ? '#FBBF24' : '#B45309', driving: dark ? '#34D399' : '#059669' }[profile];
    map.setPaintProperty('nv-route-line', 'line-color', color);
    map.setPaintProperty('nv-route-dash', 'line-color', color);

    const draw = (r: RouteInfo, fit: boolean) => {
      src.setData({
        type: 'Feature',
        properties: { real: r.real },
        geometry: { type: 'LineString', coordinates: r.coords.map(([la, ln]) => ll(la, ln)) },
      });
      if (fit) {
        const b = new lib.LngLatBounds();
        for (const [la, ln] of r.coords) b.extend(ll(la, ln));
        map.fitBounds(b, { padding: 60, maxZoom: 16, duration: 700 });
      }
    };

    const key = `${profile}|${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${selected}`;
    const cached = routeCacheRef.current.get(key);
    if (cached) {
      window.clearTimeout(timer);
      draw(cached, false);
      setRoute(cached);
      setRouting(false);
      return;
    }
    setRoute(null);
    setRouting(true);

    void (async () => {
      let drawn: RouteInfo | null = null;
      try {
        const res = await fetch(
          `https://routing.openstreetmap.de/${PROFILES[profile].router}/route/v1/driving/${origin.lng},${origin.lat};${selLng},${selLat}?overview=full&geometries=geojson&steps=true`,
          { signal: ctrl.signal },
        );
        const body = await res.json();
        const r = body?.routes?.[0];
        if (res.ok && r?.geometry?.coordinates?.length > 1) {
          drawn = {
            km: r.distance / 1000,
            min: Math.max(1, Math.round(r.duration / 60)),
            real: true,
            profile,
            coords: r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
            steps: (r.legs?.[0]?.steps ?? []).map(stepText).filter(Boolean) as RouteStep[],
          };
        }
      } catch {
        // Router unreachable / timeout / aborted — fall through.
      }
      window.clearTimeout(timer);
      if (stale()) return;
      if (!drawn) {
        const km = selKm ?? 0;
        drawn = {
          km,
          min: Math.max(1, Math.round((km / PROFILES[profile].kmh) * 60)),
          real: false,
          profile,
          coords: [
            [origin.lat, origin.lng],
            [selLat, selLng],
          ],
          steps: [],
        };
      } else {
        routeCacheRef.current.set(key, drawn);
      }
      draw(drawn, true);
      setRoute(drawn);
      setRouting(false);
    })();
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [ready, selected, selLat, selLng, selKm, origin, profile]);

  // ---------------------------------------------------------- fullscreen
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
    if (origin) map.flyTo({ center: ll(origin.lat, origin.lng), zoom: 15, duration: 800 });
    else locate();
  }

  async function share() {
    const url = window.location.href;
    const title = selPlotted ? `${selPlotted.name} on Kwaravend` : 'Stores near you on Kwaravend';
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // User dismissed the share sheet.
    }
  }

  // Arrow keys move through the list; Enter on a row already selects it.
  function onListKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = listed.findIndex((s) => s.slug === selected);
    const next = listed[Math.min(listed.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    setSelected(next.slug);
    listRef.current?.querySelector<HTMLElement>(`[data-slug="${CSS.escape(next.slug)}"]`)?.focus();
  }

  const cats = useMemo(() => categoriesOf(ilorinStores), [ilorinStores]);
  const located = state === 'ready';
  const estimate = selPlotted?.km != null ? travelEstimates(selPlotted.km) : null;

  const cityPicker = (
    <div className="nv-map-banner-cities">
      {QUICK_CITIES.map((c) => (
        <button key={c.label} type="button" className="nv-map-city" onClick={() => pickCity(c.label, c.lat, c.lng)}>
          {c.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className={`nv-map${fullscreen ? ' is-fullscreen' : ''}`} aria-label="Street map of stores">
      <div ref={spriteRef} hidden aria-hidden>
        {cats.map((c) => (
          <span key={c} data-cat={c}>
            <CategoryIcon category={c} size={20} />
          </span>
        ))}
      </div>
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
              {openCount ? ` · ${openCount} open now` : ''}
              {label ? ` around ${label}` : ' in Ilorin'}
              {!located ? ' · turn on location for distances' : ''}
            </p>
          </div>
        </div>
        <div className="nv-map-head-actions">
          <button type="button" className="nv-map-btn" onClick={recenter} title="Centre on my location">
            <Crosshair size={15} aria-hidden />
            <span>Me</span>
          </button>
          <button type="button" className="nv-map-btn" onClick={share} title="Share this map view">
            {copied ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            type="button"
            className="nv-map-btn"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
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
          {cityPicker}
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
          {cityPicker}
        </div>
      )}
      {state === 'error' && (
        <div className="nv-map-banner">
          <MapPin size={18} aria-hidden />
          <div>
            <strong>This browser can&apos;t share location</strong>
            <p>Pick a base area and every store still sorts by distance from it.</p>
          </div>
          {cityPicker}
        </div>
      )}

      {/* -------------------------------- filters ------------------------------- */}
      <div className="nv-map-filters">
        <label className="nv-map-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder="Filter by name, area or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter map stores by name, area or category"
          />
        </label>
        <div className="nv-map-cats" role="group" aria-label="Filter map by category">
          <button
            type="button"
            className={`nv-map-cat${cat === null ? ' is-active' : ''}`}
            aria-pressed={cat === null}
            onClick={() => setCat(null)}
          >
            All
          </button>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={`nv-map-cat${cat === c ? ' is-active' : ''}`}
              aria-pressed={cat === c}
              onClick={() => setCat(cat === c ? null : c)}
            >
              <span aria-hidden><CategoryIcon category={c} /></span>
              {c.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="nv-map-filters nv-map-quick" role="group" aria-label="Quick filters">
        <Toggle on={openOnly} onClick={() => setOpenOnly((v) => !v)}>
          <i className="nv-map-dot is-open" /> Open now
        </Toggle>
        <Toggle on={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>
          <VerifiedTick size={12} /> Verified
        </Toggle>
        <Toggle on={topRated} onClick={() => setTopRated((v) => !v)}>
          <Star size={12} aria-hidden /> 4.0+
        </Toggle>
        <span className="nv-map-sep" aria-hidden />
        {located ? (
          <div className="nv-map-radius" role="group" aria-label="Distance from you">
            <span>Within</span>
            {RADII.map((r) => (
              <Toggle key={r} on={radiusKm === r} onClick={() => setRadiusKm(radiusKm === r ? null : r)}>
                {r} km
              </Toggle>
            ))}
          </div>
        ) : null}
        <label className="nv-map-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort stores">
            <option value="near" disabled={!located}>
              Nearest
            </option>
            <option value="rating">Top rated</option>
            <option value="name">A–Z</option>
          </select>
        </label>
        {activeFilterCount > 0 && (
          <button type="button" className="nv-map-clear" onClick={clearFilters}>
            <X size={12} aria-hidden /> Clear {activeFilterCount}
          </button>
        )}
      </div>

      {/* --------------------------------- split -------------------------------- */}
      <div className="nv-map-layout">
        <div className="nv-map-stage">
          <div
            ref={containerRef}
            className="map-canvas nv-map-canvas"
            role="application"
            aria-label="Interactive map of stores. Click inside to enable scroll-zoom."
          />
          <div className="nv-map-tools">
            <div className="nv-map-seg" role="group" aria-label="Map style">
              <button type="button" className={base === 'streets' ? 'is-active' : ''} aria-pressed={base === 'streets'} onClick={() => setBase('streets')}>
                <Layers size={13} aria-hidden /> Streets
              </button>
              <button type="button" className={base === 'satellite' ? 'is-active' : ''} aria-pressed={base === 'satellite'} onClick={() => setBase('satellite')}>
                Satellite
              </button>
            </div>
            <button type="button" className="nv-map-chipbtn" onClick={fitAll} title="Zoom to show every result">
              <Expand size={13} aria-hidden /> Show all
            </button>
          </div>
          <div className="nv-map-legend" aria-hidden>
            <span>
              <i className="is-open" /> open
            </span>
            <span>
              <i className="is-closed" /> closed
            </span>
            <span>
              <i className="is-cluster" /> group — tap to zoom
            </span>
          </div>
          {routing && <div className="nv-map-routing">Finding the best {prof.verb} route…</div>}
          {plotted.length === 0 && (
            <div className="nv-map-overlay">
              {ilorinStores.length === 0 ? (
                <strong>No stores are pinned in Ilorin yet</strong>
              ) : (
                <>
                  <strong>No stores match those filters</strong>
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="nv-map-panel" aria-label="Stores on the map">
          <div className="nv-map-panel-head">
            <strong>{inViewOnly ? 'In this area' : 'On the map'}</strong>
            <label className="nv-map-inview" title="Only list stores visible on the map">
              <input type="checkbox" checked={inViewOnly} onChange={(e) => setInViewOnly(e.target.checked)} />
              <List size={12} aria-hidden /> Follow map
            </label>
            <span>{listed.length}</span>
          </div>
          <div className="nv-map-list" ref={listRef} onKeyDown={onListKey}>
            {listed.slice(0, 60).map((s, i) => (
              <button
                key={s.slug}
                data-slug={s.slug}
                type="button"
                className={`nv-map-store${selected === s.slug ? ' is-active' : ''}${hovered === s.slug ? ' is-hover' : ''}`}
                aria-current={selected === s.slug ? 'true' : undefined}
                onClick={() => setSelected(s.slug)}
                onMouseEnter={() => setHovered(s.slug)}
                onMouseLeave={() => setHovered((h) => (h === s.slug ? null : h))}
                onFocus={() => setHovered(s.slug)}
              >
                {sort === 'near' && s.km != null && i < 3 ? <span className="nv-map-rank">{i + 1}</span> : null}
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                  <img className="nv-map-store-logo" src={s.logo} alt="" loading="lazy" />
                ) : (
                  <span className="nv-map-store-logo is-fallback" aria-hidden>
                    <CategoryIcon category={s.category} />
                  </span>
                )}
                <span className="nv-map-store-body">
                  <strong>
                    {s.name}
                    {s.verified && <VerifiedTick size={13} />}
                    {s.isExample && <ExampleTag />}
                  </strong>
                  <em>{s.address ?? s.category.replace(/-/g, ' ')}</em>
                  <span className="nv-map-store-meta">
                    <i className={`nv-map-dot${s.open ? ' is-open' : ''}`} />
                    {s.open ? 'Open now' : 'Closed'}
                    {s.km != null && <> · {formatDistance(s.km)}</>}
                    {s.rating != null && s.reviewCount ? (
                      <>
                        {' '}
                        · <Star size={10} aria-hidden /> {s.rating.toFixed(1)}
                      </>
                    ) : null}
                  </span>
                </span>
                <ArrowUpRight size={15} className="nv-map-store-go" aria-hidden />
              </button>
            ))}
            {listed.length > 60 && <p className="nv-map-empty">Zoom in or filter to see the other {listed.length - 60}.</p>}
            {listed.length === 0 && (
              <p className="nv-map-empty">
                {inViewOnly && plotted.length ? 'No stores in this part of the map — pan or zoom out.' : 'Nothing here yet.'}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* -------------------------------- detail -------------------------------- */}
      {selPlotted && (
        <div className="nv-map-detail" aria-live="polite">
          <div className="nv-map-detail-id">
            {selPlotted.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
              <img className="nv-map-detail-logo" src={selPlotted.logo} alt={`${selPlotted.name} logo`} />
            ) : (
              <span className="nv-map-detail-logo is-fallback" aria-hidden>
                {selPlotted.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <strong>
                {selPlotted.name}
                {selPlotted.verified && <VerifiedTick size={15} />}
                {selPlotted.isExample && <ExampleTag />}
              </strong>
              <p>
                <CategoryIcon category={selPlotted.category} /> {selPlotted.category.replace(/-/g, ' ')}
                {selPlotted.isDropshipper ? ' · 🚚 dropshipper' : ''}
                {selPlotted.hoursToday ? ` · today ${selPlotted.hoursToday}` : ''}
              </p>
            </div>
            <button type="button" className="nv-map-detail-close" onClick={() => setSelected(null)} aria-label="Close details">
              <X size={17} />
            </button>
          </div>

          <div className="nv-map-detail-stats">
            <span>
              <strong>{selPlotted.km != null ? formatDistance(selPlotted.km) : '—'}</strong>
              <em>straight-line</em>
            </span>
            <span>
              <strong>
                <ProfileIcon p={profile} />{' '}
                {route
                  ? `${formatDistance(route.km)} · ${formatMinutes(route.min)}`
                  : routing
                    ? '…'
                    : estimate
                      ? profile === 'foot'
                        ? estimate.walk
                        : estimate.drive
                      : '—'}
              </strong>
              <em>{route ? (route.real ? `by road (${prof.verb})` : `${prof.verb}, direct estimate`) : origin ? `${prof.verb} estimate` : 'set your location'}</em>
            </span>
            <span>
              <strong>{selPlotted.open ? 'Open now' : selPlotted.hours ? 'Closed now' : 'Hours not set'}</strong>
              <em>{selPlotted.address ?? 'Address on the store page'}</em>
            </span>
            {selPlotted.rating != null && selPlotted.reviewCount ? (
              <span>
                <strong>
                  <Star size={13} /> {selPlotted.rating.toFixed(1)}
                </strong>
                <em>
                  {selPlotted.reviewCount} review{selPlotted.reviewCount === 1 ? '' : 's'}
                </em>
              </span>
            ) : null}
          </div>

          <div className="nv-map-detail-actions">
            <Link className="btn btn-primary btn-sm" href={`/s/${selPlotted.slug}`}>
              Visit store
            </Link>
            <a
              className="btn btn-outline btn-sm"
              href={directionsUrl(origin, { lat: selPlotted.lat, lng: selPlotted.lng }, selPlotted.name)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={14} /> Navigate
            </a>
            <div className="nv-map-toggle" role="group" aria-label="Route mode">
              {(Object.keys(PROFILES) as Profile[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`nv-map-toggle-btn${profile === p ? ' is-active' : ''}`}
                  aria-pressed={profile === p}
                  onClick={() => setProfile(p)}
                >
                  <ProfileIcon p={p} /> {PROFILES[p].label}
                </button>
              ))}
            </div>
          </div>

          {route && route.steps.length > 0 && (
            <details className="nv-map-steps">
              <summary>
                Turn-by-turn · {route.steps.length} step{route.steps.length === 1 ? '' : 's'}
              </summary>
              <ol>
                {route.steps.map((st, i) => (
                  <li key={i}>
                    <span>{st.text}</span>
                    {st.m > 0 && <em>{formatDistance(st.m / 1000)}</em>}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {!origin && (
            <p className="nv-map-detail-note">
              <button type="button" className="nv-map-linkbtn" onClick={locate}>
                Use my location
              </button>{' '}
              to draw a route here.
            </p>
          )}
        </div>
      )}

      {located && !selPlotted && (
        <p className="nv-map-hint">
          Centred on <strong>{label ?? 'your location'}</strong> — tap a pin or a store in the list to see the{' '}
          {prof.verb} route. Numbered bubbles are groups of stores; tap to zoom in.
        </p>
      )}
    </section>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`nv-map-cat nv-map-chip${on ? ' is-active' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function ProfileIcon({ p }: { p: Profile }) {
  if (p === 'foot') return <Footprints size={14} aria-hidden />;
  if (p === 'bike') return <Bike size={14} aria-hidden />;
  return <Car size={14} aria-hidden />;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function categoriesOf(stores: MapStore[]): string[] {
  return Array.from(new Set(stores.map((s) => s.category))).sort();
}

/** OSRM step → short English instruction ("Turn left onto Unity Road"). */
function stepText(step: {
  distance?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
}): RouteStep | null {
  const type = step.maneuver?.type ?? '';
  const mod = step.maneuver?.modifier ?? '';
  const road = step.name ? ` onto ${step.name}` : '';
  const m = Math.round(step.distance ?? 0);
  const dir = mod;
  switch (type) {
    case 'depart':
      return { text: `Head out${step.name ? ` on ${step.name}` : ''}`, m };
    case 'arrive':
      return { text: 'Arrive at the store', m: 0 };
    case 'roundabout':
    case 'rotary':
      return { text: `Take the roundabout${road}`, m };
    case 'continue':
    case 'new name':
      return { text: `Continue${dir && dir !== 'straight' ? ` ${dir}` : ''}${road}`, m };
    case 'merge':
    case 'on ramp':
    case 'off ramp':
    case 'fork':
    case 'end of road':
    case 'turn':
      if (mod === 'uturn') return { text: `Make a U-turn${road}`, m };
      return { text: `${dir === 'straight' ? 'Go straight' : `Turn ${dir || 'ahead'}`}${road}`, m };
    default:
      return step.name ? { text: `Continue${road}`, m } : null;
  }
}
