'use client';

// Full-screen store map (REDESIGN R4 §6). Layout feeling of a social map app —
// full-bleed map, floating search pill + chips, right-edge floating buttons,
// a draggable bottom sheet (peek / half / full) — with original Kwaravend
// styling. Stores only, Ilorin only, no live people. The buyer's position
// (if shared) never leaves the browser.
//
// Desktop (≥1024px): the sheet becomes a 400px left panel; the store detail
// slides over the list. Keys: "/" search, ↑/↓ results, Esc closes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
import {
  ArrowLeft,
  Box,
  ChevronDown,
  Clock,
  Flame,
  Layers,
  List,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  Rotate3d,
  RotateCcw,
  Search,
  Star,
  Store as StoreIcon,
  Landmark,
  X,
} from 'lucide-react';
import { directionsUrl, formatDistance, haversineKm, isOpenNow, todayHoursLabel } from '@idevtenancy/shared';
import { useViewerLocation } from '@/lib/useViewerLocation';
import { applyKwaraStyle, canShow3D, circlePolygon, createThemedMap, ll, prefersDarkMap, setBuildings3D, setTilt, type ThemedMap } from '@/lib/mapFactory';
import { AreaSelector } from '@/components/shell/AreaSelector';
import { PROFILES, fetchRoute, type Profile, type RouteInfo } from '@/lib/routing';
import { useReduceEffects } from '@/lib/useReduceEffects';
import { ILORIN_AREAS, ILORIN_CENTER, KWARA_BOUNDS, KWARA_MIN_ZOOM, inIlorin, inKwara, nearestArea } from '@/lib/ilorin';
import { LANDMARKS, searchLandmarks, type Landmark as LandmarkT, type LandmarkKind } from '@/lib/landmarks';
import { CategoryIcon, categoryColor, categoryMeta } from '@/lib/categories';
import { Chip, SegmentedControl } from '@/components/ui/chip';
import { ButtonLink, FAB } from '@/components/ui/button';
import { VerifiedTick } from '@/components/VerifiedTick';
import { ExampleTag } from '@/components/ExampleStoreBanner';
import { StorePreview } from '@/components/map/StorePreview';

export interface FullMapStore {
  id: string;
  slug: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  logo: string | null;
  verified: boolean;
  isExample: boolean;
  rating: number | null;
  reviewCount: number | null;
  whatsapp: string | null;
  hours: Record<string, [string, string] | null | undefined> | null;
}

// 'closed' = fully hidden (owner, 21 Nov 2026: the sheet must be fully exitable);
// a 'Show stores' pill brings it back.
type Sheet = 'closed' | 'peek' | 'half' | 'full';
type Row = FullMapStore & { km: number | null; open: boolean; hoursToday: string | null; area: string };

const CLUSTER_PX = 50;
const CLUSTER_OFF_ZOOM = 16;
const LABEL_ZOOM = 15;
const HEAT_KEY = 'nv-map-heat';
const PEEK_PX = 176; // visible sheet height at "peek"
const TRENDING_MIN_REAL_STORES = 12; // hide "Trending" until there's enough real data

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Lucide (ISC) glyphs as strings for landmark markers (plain HTML).
const LM_PATHS: Record<LandmarkKind, string> = {
  // Ilorin areas as landmarks: a simple map-pin.
  area: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  university: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  polytechnic: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  palace: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  mall: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  market: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/>',
  airport: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  hospital: '<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
  stadium: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  hill: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  town: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  museum: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M3 22h18"/><path d="M14 18v-7"/>',
};
const landmarkSvg = (k: LandmarkKind) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LM_PATHS[k]}</svg>`;

function track(event: string, storeId?: string) {
  try {
    void fetch('/api/map/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, storeId }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics never breaks the page */
  }
}

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

function waLink(num: string, store: string) {
  const digits = num.replace(/[^0-9]/g, '');
  const text = encodeURIComponent(`Hello ${store}, I found your store on the Kwaravend map.`);
  return `https://wa.me/${digits}?text=${text}`;
}

/* ---------------------------------------------------- route line tracer */
const ROUTE_BLUE = '#4D94FF';
const CLEAR = 'rgba(77, 148, 255, 0)';
const ROUTE_FULL = ['interpolate', ['linear'], ['line-progress'], 0, ROUTE_BLUE, 1, ROUTE_BLUE] as unknown as ExpressionSpecification;
const ROUTE_CLEAR = ['interpolate', ['linear'], ['line-progress'], 0, CLEAR, 1, CLEAR] as unknown as ExpressionSpecification;
/** The route drawn from the start up to `p` (0..1). */
function routeDrawn(p: number) {
  const x = Math.min(0.999, Math.max(0.001, p));
  return ['step', ['line-progress'], ROUTE_BLUE, x, CLEAR];
}
/** A bright pulse whose head is at `h` (0..1), with a fading tail behind it. */
function routePulse(h: number) {
  const tail = 0.16;
  const stops: Array<[number, string]> = [];
  const push = (at: number, c: string) => {
    const v = Math.min(1, Math.max(0, at));
    if (stops.length && v <= stops[stops.length - 1]![0]) return;
    stops.push([v, c]);
  };
  push(0, CLEAR);
  push(h - tail, CLEAR);
  push(h - tail / 2, 'rgba(160, 200, 255, 0.55)');
  push(h, 'rgba(255, 255, 255, 0.95)');
  push(h + 0.02, CLEAR);
  push(1, CLEAR);
  if (stops.length < 2) return ROUTE_CLEAR;
  return ['interpolate', ['linear'], ['line-progress'], ...stops.flat()];
}

export function FullMap({ stores }: { stores: FullMapStore[] }) {
  const { origin, label: originLabel, state: locState, source: locSource, accuracy, locate, pickCity } = useViewerLocation({ live: true });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [heatOn, setHeatOn] = useState(false);
  const [heatCount, setHeatCount] = useState<number | null>(null);
  const [b3d, setB3d] = useState(false);
  const [tilt, setTiltOn] = useState(false);
  // Directions on the map (owner, 21 Nov 2026): only fetched when asked for.
  const [routeProfile, setRouteProfile] = useState<Profile>('driving');
  const [routeWanted, setRouteWanted] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
  const reduceFx = useReduceEffects();
  // Route line tracer: draw the route in from you to the store, then keep a
  // bright pulse running along it. Off when effects are reduced.
  const tracerRaf = useRef<number | null>(null);
  const stopTracer = useCallback(() => {
    if (tracerRaf.current != null) cancelAnimationFrame(tracerRaf.current);
    tracerRaf.current = null;
  }, []);
  const startTracer = useCallback(
    (map: MLMap, drawIn: boolean) => {
      stopTracer();
      const setPaint = (layer: string, v: unknown) => {
        if (map.getLayer(layer)) map.setPaintProperty(layer, 'line-gradient', v as never);
      };
      if (reduceFx) {
        setPaint('fm-route-line', ROUTE_FULL);
        setPaint('fm-route-trace', ROUTE_CLEAR);
        return;
      }
      const t0 = performance.now();
      const DRAW = drawIn ? 900 : 0;
      const LOOP = 2200;
      const frame = (now: number) => {
        const t = now - t0;
        if (t < DRAW) {
          setPaint('fm-route-line', routeDrawn(t / DRAW));
          setPaint('fm-route-trace', ROUTE_CLEAR);
        } else {
          setPaint('fm-route-line', ROUTE_FULL);
          setPaint('fm-route-trace', routePulse(((t - DRAW) % LOOP) / LOOP));
        }
        tracerRaf.current = requestAnimationFrame(frame);
      };
      tracerRaf.current = requestAnimationFrame(frame);
    },
    [reduceFx, stopTracer],
  );
  useEffect(() => stopTracer, [stopTracer]);
  const [can3d, setCan3d] = useState(false);
  const [base, setBase] = useState<'streets' | 'satellite'>('streets');
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>('peek');
  const [zoom, setZoom] = useState(13);
  const [desktop, setDesktop] = useState(false);
  const [sort, setSort] = useState<'near' | 'rating' | 'name'>('near');
  const [showLandmarks, setShowLandmarks] = useState(true);
  const landmarkMarkers = useRef<Marker[]>([]);
  const landmarkHits = useMemo(() => searchLandmarks(query), [query]);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<ThemedMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const initRef = useRef<Promise<ThemedMap> | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerBySlug = useRef<Map<string, Marker>>(new Map());
  const meRef = useRef<Marker | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  // ---------------------------------------------------------------- data
  const outside = !!origin && !inKwara(origin.lat, origin.lng);
  const distOrigin = origin && !outside ? origin : null;

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = stores
      .filter((s) => inIlorin(s.lat, s.lng))
      .filter((s) => (cat ? s.category === cat : true))
      .filter((s) =>
        q
          ? s.name.toLowerCase().includes(q) ||
            (s.address ?? '').toLowerCase().includes(q) ||
            categoryMeta(s.category).label.toLowerCase().includes(q) ||
            nearestArea(s.lat, s.lng).label.toLowerCase().includes(q)
          : true,
      )
      .map((s) => ({
        ...s,
        km: distOrigin ? haversineKm(distOrigin, { lat: s.lat, lng: s.lng }) : null,
        open: isOpenNow(s.hours),
        hoursToday: todayHoursLabel(s.hours),
        area: nearestArea(s.lat, s.lng).label,
      }))
      .filter((s) => (openOnly ? s.open : true));
    const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
    if (sort === 'rating') out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b));
    else if (sort === 'name') out.sort(byName);
    else out.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || byName(a, b));
    return out;
  }, [stores, query, cat, openOnly, sort, distOrigin]);

  const cats = useMemo(
    () => Array.from(new Set(stores.filter((s) => inIlorin(s.lat, s.lng)).map((s) => s.category))).sort(),
    [stores],
  );
  const sel = rows.find((r) => r.slug === selected) ?? null;
  const realCount = stores.filter((s) => !s.isExample).length;
  const trending = realCount >= TRENDING_MIN_REAL_STORES
    ? rows.filter((r) => !r.isExample && (r.reviewCount ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8)
    : [];

  // ------------------------------------------------------ prefs + URL sync
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    setCan3d(canShow3D());
    setHeatOn(readStore(HEAT_KEY) === '1'); // off for first-time visitors
    const p = new URLSearchParams(window.location.search);
    const s = p.get('store');
    if (s && stores.some((x) => x.slug === s)) setSelected(s);
    const sh = p.get('sheet');
    if (sh === 'half' || sh === 'full' || sh === 'peek' || sh === 'closed') setSheet(sh);
    track('map_opened');
    return () => mq.removeEventListener('change', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set('store', selected);
    else url.searchParams.delete('store');
    if (!desktop && sheet !== 'peek') url.searchParams.set('sheet', sheet);
    else url.searchParams.delete('sheet');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [selected, sheet, desktop]);

  // -------------------------------------------------------------- map init
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // Slow mobile data is normal: only fall back after a long wait, or at once
    // when the browser says it's offline. The map keeps loading underneath and
    // the fallback disappears as soon as it's ready.
    const failTimer = window.setTimeout(() => {
      if (!mapRef.current) setFailed(true);
    }, 25000);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setFailed(true);
    void (async () => {
      if (!mapEl.current) return;
      try {
        initRef.current ??= createThemedMap(mapEl.current, {
          center: ILORIN_CENTER,
          zoom: 13,
          zoomControl: false,
          scrollWheelZoom: true,
          maxBounds: KWARA_BOUNDS,
          minZoom: KWARA_MIN_ZOOM,
        });
        const [map, lib] = await Promise.all([initRef.current, import('maplibre-gl')]);
        if (cancelled) return;
        window.clearTimeout(failTimer);
        libRef.current = lib;
        mapRef.current = map;
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        // Heat layer: aggregated, anonymised activity (see /api/map/heat).
        map.addSource('nv-heat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer(
          {
            id: 'nv-heat',
            type: 'heatmap',
            source: 'nv-heat',
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 5, 0.3, 60, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 2],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 22, 16, 60],
              'heatmap-opacity': 0.75,
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(79,140,255,0)',
                0.25, 'rgba(79,140,255,0.4)',
                0.6, '#34D399',
                1, '#FF6B6B',
              ],
            },
          },
          map.getStyle().layers?.find((l) => l.type === 'symbol')?.id,
        );

        // GPS accuracy ring around the viewer's exact position.
        map.addSource('nv-accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'nv-accuracy-fill', type: 'fill', source: 'nv-accuracy', paint: { 'fill-color': '#4F8CFF', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'nv-accuracy-line', type: 'line', source: 'nv-accuracy', paint: { 'line-color': '#4F8CFF', 'line-width': 1.5, 'line-opacity': 0.6 } });

        // Route to the selected store: solid for a road route, dashed for the
        // straight-line fallback. Blue = "on the way" (REDESIGN_V2 §2.6).
        // lineMetrics: line-progress drives the animated tracer below.
        map.addSource('fm-route', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'fm-route-casing',
          type: 'line',
          source: 'fm-route',
          filter: ['==', ['get', 'real'], true],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#050506', 'line-width': 9, 'line-opacity': 0.55 },
        });
        map.addLayer({
          id: 'fm-route-line',
          type: 'line',
          source: 'fm-route',
          filter: ['==', ['get', 'real'], true],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': 5, 'line-opacity': 0.95, 'line-gradient': ROUTE_FULL },
        });
        map.addLayer({
          id: 'fm-route-dash',
          type: 'line',
          source: 'fm-route',
          filter: ['==', ['get', 'real'], false],
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': '#4D94FF', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 2] },
        });
        // Line tracer: a bright pulse that runs along the route from you to
        // the store (both the road route and the straight-line fallback).
        map.addLayer({
          id: 'fm-route-trace',
          type: 'line',
          source: 'fm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': 9, 'line-blur': 3, 'line-gradient': ROUTE_CLEAR },
        });

        const sync = () => setZoom(Math.round(map.getZoom() * 2) / 2);
        map.on('moveend', sync);
        map.on('click', () => setLayersOpen(false));
        sync();

        // Follow the app theme live (the toggle can flip it while open).
        const obs = new MutationObserver(() => applyKwaraStyle(map, prefersDarkMap()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        cleanup = () => {
          obs.disconnect();
          for (const m of markersRef.current) m.remove();
          markersRef.current = [];
          markerBySlug.current.clear();
          meRef.current?.remove();
          meRef.current = null;
          map.remove();
          initRef.current = null;
          mapRef.current = null;
        };
        setReady(true);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setBaseLayer(base);
  }, [base, ready]);

  useEffect(() => {
    if (ready && mapRef.current) setBuildings3D(mapRef.current, b3d);
    if (b3d) setTiltOn(true); // buildings read best from an angle
  }, [b3d, ready]);

  // Tilt view (2.5D): pitch + horizon fog. Pins are DOM markers, so they stay upright.
  useEffect(() => {
    if (ready && mapRef.current) setTilt(mapRef.current, tilt, prefersDarkMap(), !reduceFx);
  }, [tilt, ready, reduceFx]);

  // Heat data (fetched once, only when the layer is on).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer('nv-heat')) map.setLayoutProperty('nv-heat', 'visibility', heatOn ? 'visible' : 'none');
    if (!heatOn || heatCount !== null) return;
    void fetch('/api/map/heat')
      .then((r) => r.json())
      .then((body) => {
        const cells: Array<{ lat: number; lng: number; count: number }> = body?.data?.cells ?? body?.cells ?? [];
        setHeatCount(cells.length);
        (map.getSource('nv-heat') as GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: cells.map((c) => ({
            type: 'Feature',
            properties: { count: c.count },
            geometry: { type: 'Point', coordinates: ll(c.lat, c.lng) },
          })),
        });
      })
      .catch(() => setHeatCount(0));
  }, [heatOn, ready, heatCount]);

  // ------------------------------------------------------- pins + clusters
  const pinSvg = (category: string) =>
    spriteRef.current?.querySelector(`[data-cat="${CSS.escape(category)}"]`)?.innerHTML ?? '';

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    markerBySlug.current.clear();

    const z = map.getZoom();
    type Bucket = { items: Row[]; x: number; y: number };
    const buckets: Bucket[] = [];
    const solo: Row[] = [];
    for (const s of rows) {
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
      const n = b.items.length;
      const size = n < 10 ? 42 : n < 50 ? 50 : 58;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'fm-cluster';
      el.style.width = el.style.height = `${size}px`;
      el.setAttribute('aria-label', `${n} stores here, zoom in`);
      el.textContent = String(n);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const bounds = new lib.LngLatBounds();
        for (const i of b.items) bounds.extend(ll(i.lat, i.lng));
        map.fitBounds(bounds, { padding: 80, maxZoom: CLUSTER_OFF_ZOOM, duration: 650 });
      });
      add(el, b.items.reduce((a, i) => a + i.lat, 0) / n, b.items.reduce((a, i) => a + i.lng, 0) / n);
    }
    for (const s of solo) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `fm-pin${s.open ? ' is-open' : ''}${s.slug === selectedRef.current ? ' is-selected' : ''}`;
      el.style.setProperty('--ring', categoryColor(s.category));
      el.setAttribute('aria-label', `${s.name}, ${categoryMeta(s.category).label}${s.open ? ', open now' : ''}`);
      const face = s.logo ? `<img src="${esc(s.logo)}" alt="" />` : pinSvg(s.category);
      el.innerHTML = `<span class="fm-pin-face">${face}</span><span class="fm-pin-label">${esc(s.name)}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(s.slug);
        setSheet((cur) => (cur === 'full' ? 'full' : 'half'));
        track('pin_tapped', s.id);
      });
      markerBySlug.current.set(s.slug, add(el, s.lat, s.lng));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pinSvg reads a ref
  }, [ready, rows, zoom, selected]);

  // Kwara landmarks: small labelled reference markers (not stores).
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    for (const m of landmarkMarkers.current) m.remove();
    landmarkMarkers.current = [];
    if (!showLandmarks) return;
    for (const l of LANDMARKS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `fm-lm kind-${l.kind}${l.kind === 'town' ? ' is-town' : ''}`;
      const approx = l.precision === 'town' ? ' (approximate location, town centre)' : l.precision === 'approx' ? ' (area centre, approximate)' : '';
      el.setAttribute('aria-label', `${l.kind === 'area' ? 'Area' : 'Landmark'}: ${l.name}, ${l.place}${approx}`);
      if (l.precision === 'town') el.title = `${l.name}: approximate location (town centre)`;
      el.innerHTML = `<span class="fm-lm-dot">${landmarkSvg(l.kind)}</span><span class="fm-lm-label">${esc(l.short ?? l.name)}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo({ center: ll(l.lat, l.lng), zoom: Math.max(map.getZoom(), l.kind === 'town' ? 13 : 15.5), duration: 800, essential: true });
      });
      landmarkMarkers.current.push(new lib.Marker({ element: el, anchor: 'center' }).setLngLat(ll(l.lat, l.lng)).addTo(map));
    }
    return () => {
      for (const m of landmarkMarkers.current) m.remove();
      landmarkMarkers.current = [];
    };
  }, [ready, showLandmarks]);

  const flyLandmark = (l: LandmarkT) => {
    setSelected(null);
    mapRef.current?.flyTo({ center: ll(l.lat, l.lng), zoom: l.kind === 'town' ? 13 : 15.5, duration: 900, essential: true });
    if (!desktop) setSheet('peek');
  };

  // Fly to a selected store (spring-grown pin is handled in CSS).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !sel) return;
    const offsetY = desktop ? 0 : -Math.round(window.innerHeight * 0.18);
    map.flyTo({
      center: ll(sel.lat, sel.lng),
      zoom: Math.max(map.getZoom(), 15.5),
      offset: [desktop ? 200 : 0, offsetY],
      duration: 800,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on selection only
  }, [selected, ready]);

  // Viewer dot (only inside Ilorin; outside we stay on Ilorin).
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const ring = map.getSource('nv-accuracy') as GeoJSONSource | undefined;
    if (!distOrigin) {
      meRef.current?.remove();
      meRef.current = null;
      ring?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    // Live GPS updates move the same marker instead of re-creating it.
    if (meRef.current) meRef.current.setLngLat(ll(distOrigin.lat, distOrigin.lng));
    else {
      const el = document.createElement('span');
      el.className = `map-me-wrap${locSource === 'gps' ? ' is-gps' : ''}`;
      el.innerHTML = '<span class="map-me"><i></i></span>';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-label', locSource === 'gps' ? 'Your exact location' : `Your chosen area: ${originLabel ?? ''}`);
      meRef.current = new lib.Marker({ element: el, anchor: 'center' }).setLngLat(ll(distOrigin.lat, distOrigin.lng)).addTo(map);
    }
    meRef.current.getElement().classList.toggle('is-gps', locSource === 'gps');
    ring?.setData(
      locSource === 'gps' && accuracy && accuracy > 5
        ? circlePolygon(distOrigin.lat, distOrigin.lng, Math.min(accuracy, 2000) / 1000)
        : { type: 'FeatureCollection', features: [] },
    );
  }, [ready, distOrigin, locSource, accuracy, originLabel]);

  // ------------------------------------------------------------- route
  // Tapping a store draws the way there straight away (owner, 23 Nov 2026):
  // the route line from you to the store shows without a second tap. With
  // no starting point yet, ask for the device location once; the route
  // follows as soon as a fix arrives.
  useEffect(() => {
    setRoute(null);
    setAllSteps(false);
    setRouteWanted(!!selected);
    if (selected && !distOrigin && locState === 'idle') locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new selection only
  }, [selected]);
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    const src = map?.getSource('fm-route') as GeoJSONSource | undefined;
    if (!ready || !map || !lib || !src) return;
    if (!routeWanted || !sel || !distOrigin) {
      stopTracer();
      src.setData({ type: 'FeatureCollection', features: [] });
      setRouting(false);
      if (!routeWanted) setRoute(null);
      return;
    }
    const ctrl = new AbortController();
    setRouting(true);
    fetchRoute(distOrigin, { lat: sel.lat, lng: sel.lng }, routeProfile, ctrl.signal)
      .then((r) => {
        setRoute(r);
        setRouting(false);
        src.setData({
          type: 'Feature',
          properties: { real: r.real },
          geometry: { type: 'LineString', coordinates: r.coords.map(([la, ln]) => ll(la, ln)) },
        });
        startTracer(map, r.real && !reduceFx);
        const b = new lib.LngLatBounds();
        for (const [la, ln] of r.coords) b.extend(ll(la, ln));
        map.fitBounds(b, { padding: desktop ? { top: 90, bottom: 60, left: 460, right: 80 } : { top: 140, bottom: Math.round(window.innerHeight * 0.55), left: 40, right: 70 }, maxZoom: 16, duration: 700 });
        track('route_shown', sel.id);
      })
      .catch(() => {
        /* aborted: a newer request took over */
      });
    return () => {
      ctrl.abort();
      stopTracer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when these change
  }, [ready, routeWanted, routeProfile, sel?.slug, distOrigin?.lat, distOrigin?.lng]);

  // ------------------------------------------------------------ controls
  const flyArea = useCallback((lat: number, lng: number, z = 15) => {
    mapRef.current?.flyTo({ center: ll(lat, lng), zoom: z, duration: 800, essential: true });
  }, []);
  // /map?area=<id> (from the /home mini-map card) opens on that Ilorin area.
  const areaDone = useRef(false);
  useEffect(() => {
    if (!ready || areaDone.current) return;
    areaDone.current = true;
    const id = new URLSearchParams(window.location.search).get('area');
    const hit = ILORIN_AREAS.find((a) => a.id === id);
    if (hit && !selected) flyArea(hit.lat, hit.lng, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the map is ready
  }, [ready]);
  const resetIlorin = () => {
    setSelected(null);
    flyArea(ILORIN_CENTER[0], ILORIN_CENTER[1], 13);
  };
  // Locate me always asks the device for a fresh, high-accuracy fix (a picked
  // area or an old save is never treated as "you"), then flies close in.
  const wantFly = useRef(false);
  const locateMe = () => {
    wantFly.current = true;
    if (locSource === 'gps' && distOrigin) flyArea(distOrigin.lat, distOrigin.lng, 17);
    locate();
  };
  useEffect(() => {
    if (locState !== 'ready' || locSource !== 'gps' || !distOrigin || !wantFly.current) return;
    wantFly.current = false;
    flyArea(distOrigin.lat, distOrigin.lng, 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first fix after a tap
  }, [locState, locSource, distOrigin]);

  const toggleHeat = () => {
    setHeatOn((v) => {
      writeStore(HEAT_KEY, v ? '0' : '1');
      return !v;
    });
    track('heat_toggled');
  };

  // Keyboard: "/" search, arrows through results, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        if (!desktop) setSheet('half');
      } else if (e.key === 'Escape') {
        if (layersOpen) setLayersOpen(false);
        else if (selectedRef.current) setSelected(null);
        else if (!desktop) setSheet((s) => (s === 'peek' ? 'closed' : 'peek'));
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing && rows.length) {
        e.preventDefault();
        const idx = rows.findIndex((r) => r.slug === selectedRef.current);
        const next = rows[Math.min(rows.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))];
        setSelected(next.slug);
        listRef.current?.querySelector<HTMLElement>(`[data-slug="${CSS.escape(next.slug)}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, desktop, layersOpen]);

  // ------------------------------------------------------- bottom sheet drag
  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number; base: number } | null>(null);
  // Snap points follow the real viewport (rotation, mobile browser bars).
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const snapY = useCallback(
    (s: Sheet) => {
      if (s === 'full') return 64;
      if (s === 'half') return Math.round(vh * 0.48);
      if (s === 'closed') return vh + 12; // fully off screen
      return vh - PEEK_PX;
    },
    [vh],
  );
  const onDragStart = (e: React.PointerEvent) => {
    if (desktop) return;
    const el = sheetRef.current;
    if (!el) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startT: performance.now(), lastY: e.clientY, lastT: performance.now(), base: snapY(sheet) };
    el.style.transition = 'none';
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const y = Math.min(vh, Math.max(snapY('full'), d.base + (e.clientY - d.startY)));
    el.style.transform = `translateY(${y}px)`;
    d.lastY = e.clientY;
    d.lastT = performance.now();
  };
  const onDragEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = '';
    const moved = e.clientY - d.startY;
    // Always write the target position: if the snap point doesn't change,
    // React won't re-apply the same inline style, and a cleared transform
    // used to leave the sheet stuck at the top of the screen.
    const go = (next: Sheet) => {
      el.style.transform = `translateY(${snapY(next)}px)`;
      setSheet(next);
    };
    if (Math.abs(moved) < 6) {
      // a tap on the handle cycles up
      go(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'half');
      return;
    }
    const v = (e.clientY - d.lastY) / Math.max(1, performance.now() - d.lastT) + moved / Math.max(1, performance.now() - d.startT);
    const projected = d.base + moved + v * 220; // momentum
    const opts: Sheet[] = ['full', 'half', 'peek', 'closed'];
    go(opts.reduce((a, b) => (Math.abs(snapY(b) - projected) < Math.abs(snapY(a) - projected) ? b : a)));
  };

  // ----------------------------------------------------------------- render
  const sheetStyle = desktop ? undefined : { transform: `translateY(${snapY(sheet)}px)` };
  const hasStores = stores.some((s) => inIlorin(s.lat, s.lng));

  const card = (s: Row, compact = false) => (
    <button
      key={s.slug}
      type="button"
      data-slug={s.slug}
      className={`fm-card${compact ? ' is-compact' : ''}${selected === s.slug ? ' is-active' : ''}`}
      onClick={() => {
        setSelected(s.slug);
        if (!desktop && sheet === 'peek') setSheet('half');
      }}
    >
      <span className="fm-card-logo" style={{ ['--ring' as string]: categoryColor(s.category) }}>
        {s.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
          <img src={s.logo} alt="" loading="lazy" />
        ) : (
          <CategoryIcon category={s.category} size={20} />
        )}
      </span>
      <span className="fm-card-body">
        <strong>
          <span className="fm-card-name">{s.name}</span>
          {s.verified && <VerifiedTick size={13} />}
          {s.isExample && <ExampleTag />}
        </strong>
        <em>
          {categoryMeta(s.category).label} · {s.area}
        </em>
        <span className="fm-card-meta">
          <i className={`fm-dot${s.open ? ' is-open' : ''}`} aria-hidden />
          {s.open ? 'Open now' : 'Closed'}
          {s.km != null && <> · {formatDistance(s.km)}</>}
          {s.rating != null && (s.reviewCount ?? 0) > 0 && (
            <>
              {' '}· <Star size={11} aria-hidden className="fm-star" /> {s.rating.toFixed(1)}
            </>
          )}
        </span>
      </span>
    </button>
  );

  const detail = sel && (
    <div className="fm-detail" role="region" aria-label={`${sel.name} details`}>
      <div className="fm-detail-head">
        <span className="fm-card-logo is-lg" style={{ ['--ring' as string]: categoryColor(sel.category) }}>
          {sel.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
            <img src={sel.logo} alt="" />
          ) : (
            <CategoryIcon category={sel.category} size={24} />
          )}
        </span>
        <div className="fm-detail-id">
          <h2>
            {sel.name}
            {sel.verified && <VerifiedTick size={15} />}
          </h2>
          <p>
            <CategoryIcon category={sel.category} size={14} /> {categoryMeta(sel.category).label} · {sel.area}
          </p>
          {sel.isExample && (
            <p className="fm-detail-example">
              <ExampleTag /> Sample data. This store can&apos;t take orders.
            </p>
          )}
        </div>
        <button type="button" className="fm-close" aria-label="Close store details" onClick={() => setSelected(null)}>
          <X size={18} aria-hidden />
        </button>
      </div>
      <dl className="fm-facts">
        <div>
          <dt>
            <Clock size={14} aria-hidden /> Today
          </dt>
          <dd>
            <span className={`fm-status${sel.open ? ' is-open' : ''}`}>{sel.open ? 'Open now' : sel.hours ? 'Closed' : 'Hours not set'}</span>
            {sel.hoursToday ? ` · ${sel.hoursToday}` : ''}
          </dd>
        </div>
        <div>
          <dt>
            <MapPin size={14} aria-hidden /> Where
          </dt>
          <dd>
            {sel.address ?? sel.area}
            {sel.km != null && ` · ${formatDistance(sel.km)} away`}
          </dd>
        </div>
        <div>
          <dt>
            <Star size={14} aria-hidden /> Rating
          </dt>
          <dd>
            {sel.rating != null && (sel.reviewCount ?? 0) > 0
              ? `${sel.rating.toFixed(1)} from ${sel.reviewCount} review${sel.reviewCount === 1 ? '' : 's'}`
              : 'No reviews yet'}
          </dd>
        </div>
      </dl>
      <div className="fm-actions">
        <ButtonLink
          href={`/s/${sel.slug}`}
          variant="primary"
          leadingIcon={StoreIcon}
          onClick={() => track('store_order_clicked', sel.id)}
        >
          {sel.isExample ? 'View store' : 'Order'}
        </ButtonLink>
        {sel.whatsapp && !sel.isExample ? (
          <ButtonLink href={waLink(sel.whatsapp, sel.name)} external variant="whatsapp" leadingIcon={MessageCircle}>
            WhatsApp
          </ButtonLink>
        ) : null}
        <ButtonLink
          href={directionsUrl(distOrigin, { lat: sel.lat, lng: sel.lng }, sel.name)}
          external
          variant="secondary"
          leadingIcon={Navigation}
          onClick={() => track('store_directions_clicked', sel.id)}
        >
          Directions
        </ButtonLink>
      </div>
      <StorePreview slug={sel.slug} />
      <div className="fm-route" aria-live="polite">
        <h3>
          <Navigation size={15} aria-hidden /> The way here
        </h3>
        {!distOrigin ? (
          <>
            <p className="fm-route-note" role={locState === 'denied' || locState === 'error' ? 'alert' : undefined}>
              {locState === 'locating'
                ? 'Finding your location…'
                : locState === 'denied'
                  ? 'Location is blocked for this site, so we can’t draw the way from you. Allow location in your browser settings, or pick your area under Areas in Ilorin.'
                  : locState === 'error'
                    ? 'Your location isn’t available right now (no GPS fix, or this device has no location). Try again near a window, or pick your area under Areas in Ilorin.'
                    : outside
                      ? 'You’re outside Kwara, so the route can’t start from your location. Pick an Ilorin area under Areas in Ilorin to start from there.'
                      : 'Share your location or pick your area to see the route, distance and time on the map.'}
            </p>
            {locState !== 'locating' && locState !== 'denied' && (
              <button type="button" className="btn btn-primary btn-sm fm-route-go" onClick={locateMe}>
                <LocateFixed size={15} aria-hidden /> {locState === 'error' ? 'Try again' : 'Use my location'}
              </button>
            )}
            <p className="fm-route-privacy">Your location stays on this device. Kwaravend&apos;s servers never receive it.</p>
          </>
        ) : (
          <>
            <SegmentedControl
              label="How are you going?"
              value={routeProfile}
              onChange={(v) => setRouteProfile(v)}
              options={(Object.keys(PROFILES) as Profile[]).map((k) => ({ value: k, label: PROFILES[k].label }))}
            />
            {!routeWanted ? (
              <button type="button" className="btn btn-primary btn-sm fm-route-go" onClick={() => setRouteWanted(true)}>
                <Navigation size={15} aria-hidden /> Show the way here
              </button>
            ) : routing ? (
              <p className="fm-route-note">Finding the way…</p>
            ) : route ? (
              <>
                <p className="fm-route-sum">
                  <strong>
                    About {route.min} min {PROFILES[route.profile].verb}
                  </strong>{' '}
                  · {formatDistance(route.km)}
                  {!route.real && ' in a straight line (the road route couldn’t load)'}
                </p>
                {route.steps.length > 0 && (
                  <ol className="fm-route-steps">
                    {(allSteps ? route.steps : route.steps.slice(0, 6)).map((st, i) => (
                      <li key={i}>
                        {st.text}
                        {st.m > 0 && <em> · {st.m >= 1000 ? `${(st.m / 1000).toFixed(1)} km` : `${st.m} m`}</em>}
                      </li>
                    ))}
                    {route.steps.length > 6 && (
                      <li className="fm-route-more">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllSteps((v) => !v)} aria-expanded={allSteps}>
                          {allSteps ? 'Show fewer steps' : `Show all ${route.steps.length} steps`}
                        </button>
                      </li>
                    )}
                  </ol>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRouteWanted(false)}>
                  <X size={15} aria-hidden /> Hide route
                </button>
              </>
            ) : null}
            <p className="fm-route-privacy">
              From {locSource === 'gps' ? 'your location' : (originLabel ?? 'your area')}. Your location stays on this device and is
              never sent to Kwaravend. The route is worked out by OpenStreetMap&apos;s routing service, which receives only the two
              points when you open a store on the map.
            </p>
          </>
        )}
      </div>
    </div>
  );

  const list = (
    <div className="fm-list" ref={listRef}>
      {rows.map((r) => card(r))}
      {rows.length === 0 && hasStores && (
        <div className="fm-empty">
          <Search size={22} aria-hidden />
          <p>No stores match. Try another word or clear the filters.</p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setQuery('');
              setCat(null);
              setOpenOnly(false);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  const empty = !hasStores && (
    <div className="fm-empty">
      <StoreIcon size={24} aria-hidden />
      <p>No stores here yet. Ilorin sellers can open a free store and appear on this map.</p>
      <ButtonLink href="/dashboard" variant="primary" size="sm">
        Invite a seller: open a store
      </ButtonLink>
    </div>
  );

  // Map failed (offline, tiles blocked): the list, grouped by area, shown over
  // the still-loading map.
  let fallback: React.ReactNode = null;
  if (failed && !ready) {
    const groups = new Map<string, Row[]>();
    for (const r of rows) groups.set(r.area, [...(groups.get(r.area) ?? []), r]);
    fallback = (
      <div className="fm-fallback" role="region" aria-label="Stores by area">
        <header className="fm-fallback-head">
          <Link href="/discover" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} aria-hidden /> Back
          </Link>
          <h1>Stores in Kwara</h1>
          <p>The map couldn&apos;t load (you may be offline). Here are the stores by area.</p>
        </header>
        {empty}
        {[...groups.entries()].map(([area, items]) => (
          <section key={area} className="fm-fallback-group">
            <h2>
              <MapPin size={16} aria-hidden /> {area}
            </h2>
            <div className="fm-list">{items.map((r) => card(r))}</div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={`fm${desktop ? ' is-desktop' : ''}${zoom >= LABEL_ZOOM ? ' show-labels' : ''}${sel ? ' has-selection' : ''}`}>
      <div ref={spriteRef} hidden aria-hidden>
        {cats.map((c) => (
          <span key={c} data-cat={c}>
            <CategoryIcon category={c} size={20} />
          </span>
        ))}
      </div>

      <div ref={mapEl} className="fm-map" role="application" aria-label="Map of stores in Kwara" />
      {fallback}
      {!ready && <div className="fm-map-loading" aria-hidden />}

      {/* ---------------------------------------------- top: search + chips */}
      <div className="fm-top">
        <div className="fm-search glass">
          <Link href="/discover" className="fm-search-back" aria-label="Back to Discover" title="Back">
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <Search size={17} aria-hidden className="fm-search-ico" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => !desktop && setSheet((s) => (s === 'peek' || s === 'closed' ? 'half' : s))}
            placeholder="Search a store, area or landmark"
            aria-label="Search stores, areas or landmarks in Ilorin"
            enterKeyHint="search"
          />
          {query && (
            <button type="button" className="fm-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={16} aria-hidden />
            </button>
          )}
          <kbd className="fm-kbd" aria-hidden>
            /
          </kbd>
        </div>
        <div className="fm-chips" role="group" aria-label="Filters">
          <Chip label="Open now" icon={Clock} selected={openOnly} onClick={() => setOpenOnly((v) => !v)} />
          <Chip label="Heat" icon={Flame} selected={heatOn} onClick={toggleHeat} />
          <Chip label="Landmarks" icon={Landmark} selected={showLandmarks} onClick={() => setShowLandmarks((v) => !v)} />
          <Chip label="All" selected={cat === null} onClick={() => setCat(null)} />
          {cats.map((c) => (
            <Chip key={c} label={categoryMeta(c).label} category={c} selected={cat === c} onClick={() => setCat(cat === c ? null : c)} />
          ))}
        </div>
        {heatOn && heatCount === 0 && (
          <p className="fm-note glass" role="status">
            Not enough activity in the last 24 hours to show a heat area yet (each area needs at least 5 visits).
          </p>
        )}
        {outside && (
          <p className="fm-note glass" role="status">
            Your exact location is outside Kwara, so we&apos;re showing Ilorin. Pick an area or place below to explore.
          </p>
        )}
        {(locState === 'denied' || locState === 'error') && (
          <p className="fm-note glass" role="status">
            {locState === 'denied'
              ? 'Location is blocked for this site. Allow it in your browser settings to see your exact spot.'
              : 'Couldn’t get a GPS fix. Move near a window or outdoors and tap Locate me again.'}
          </p>
        )}
      </div>

      {/* ------------------------------------------------- right-edge FABs */}
      <div className="fm-fabs">
        <FAB icon={LocateFixed} label={locState === 'locating' ? 'Finding you…' : 'Locate me'} onClick={locateMe} />
        <div className="fm-layers-wrap">
          <FAB icon={Layers} label="Map layers" active={layersOpen} onClick={() => setLayersOpen((v) => !v)} />
          {layersOpen && (
            <div className="fm-layers glass" role="dialog" aria-label="Map layers">
              <SegmentedControl
                label="Map style"
                value={base}
                onChange={setBase}
                options={[
                  { value: 'streets', label: 'Streets' },
                  { value: 'satellite', label: 'Satellite' },
                ]}
              />
              <Chip label="Heat" icon={Flame} selected={heatOn} onClick={toggleHeat} />
              {can3d && <Chip label="3D buildings" icon={Box} selected={b3d} onClick={() => setB3d((v) => !v)} />}
            </div>
          )}
        </div>
        <FAB
          icon={Rotate3d}
          label={tilt ? 'Flat view' : 'Tilt view'}
          active={tilt}
          onClick={() => {
            setTiltOn((v) => !v);
            track('tilt_toggled');
          }}
        />
        <FAB icon={RotateCcw} label="Reset to Ilorin" onClick={resetIlorin} />
      </div>

      {/* Sheet hidden: one pill brings it back (and the map is fully free). */}
      {!desktop && sheet === 'closed' && (
        <button type="button" className="fm-reopen glass" onClick={() => setSheet('peek')}>
          <List size={17} aria-hidden /> Show {rows.length} store{rows.length === 1 ? '' : 's'}
        </button>
      )}

      {/* ------------------------------------- bottom sheet / desktop panel */}
      <aside
        ref={sheetRef}
        className={`fm-sheet glass is-${sheet}`}
        style={sheetStyle}
        aria-label="Stores on the map"
      >
        {!desktop && (
          <div
            className="fm-handle"
            role="button"
            tabIndex={0}
            aria-label={`Store list, ${sheet === 'peek' ? 'collapsed' : sheet === 'half' ? 'half open' : 'expanded'}. ${sheet === 'full' ? 'Activate to collapse.' : 'Activate to expand.'} Drag down to hide.`}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSheet((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
              }
            }}
          >
            <span className="fm-grabber" aria-hidden />
          </div>
        )}

        <div
          className="fm-sheet-head"
          onPointerDown={desktop ? undefined : onDragStart}
          onPointerMove={desktop ? undefined : onDragMove}
          onPointerUp={desktop ? undefined : onDragEnd}
          onPointerCancel={desktop ? undefined : onDragEnd}
        >
          {!desktop && (
            <button
              type="button"
              className="fm-sheet-close"
              aria-label="Hide the store list"
              title="Hide the store list"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setSheet('closed')}
            >
              <X size={18} aria-hidden />
            </button>
          )}
          <h1>
            {rows.length} store{rows.length === 1 ? '' : 's'} in Kwara
          </h1>
          <p>
            {distOrigin
              ? locSource === 'gps'
                ? `Distances from your exact location${accuracy ? ` (within ${accuracy} m)` : ''}`
                : `Distances from ${originLabel ?? 'your area'} · tap Locate me for your exact spot`
              : 'Tap Locate me for distances'}
            {stores.some((s) => s.isExample) ? ' · stores marked Example show sample data' : ''}
          </p>
        </div>

        {/* Peek: a swipeable row of nearby stores */}
        {!desktop && sheet === 'peek' && !sel && (
          <div className="fm-peek" role="list">
            {rows.slice(0, 12).map((r) => (
              <div role="listitem" key={r.slug}>
                {card(r, true)}
              </div>
            ))}
            {!hasStores && empty}
          </div>
        )}

        {(desktop || (sheet !== 'peek' && sheet !== 'closed') || sel) && (
          <div className="fm-sheet-body">
            {sel && <div className="fm-detail-wrap">{detail}</div>}
            <div className={`fm-browse${sel ? ' is-covered' : ''}`} aria-hidden={sel && desktop ? true : undefined}>
              {trending.length > 0 && (
                <section className="fm-trending">
                  <h2>Trending in Kwara</h2>
                  <div className="fm-peek">{trending.map((r) => card(r, true))}</div>
                </section>
              )}
              {landmarkHits.length > 0 && (
                <section className="fm-areas" aria-label="Landmarks matching your search">
                  <h2>Landmarks</h2>
                  <div className="fm-chips is-wrap">
                    {landmarkHits.map((l) => (
                      <Chip key={l.id} label={`${l.short ?? l.name} · ${l.place}`} icon={Landmark} onClick={() => flyLandmark(l)} />
                    ))}
                  </div>
                </section>
              )}
              <section className="fm-areas" aria-label="Jump to an area">
                <h2>Areas in Ilorin</h2>
                {/* Owner, 21 Nov 2026: a simple dropdown, shared with /home. */}
                <AreaSelector
                  label="Fly to an Ilorin area"
                  onChange={(id) => {
                    const a = ILORIN_AREAS.find((x) => x.id === id);
                    // The chosen area becomes the starting point for distances
                    // and routes, unless the buyer already shared their GPS.
                    if (a && locSource !== 'gps') pickCity(a.label, a.lat, a.lng);
                    if (a) flyArea(a.lat, a.lng);
                    else flyArea(ILORIN_CENTER[0], ILORIN_CENTER[1], 13);
                  }}
                />
              </section>
              <section className="fm-areas" aria-label="Landmarks">
                <h2>Landmarks</h2>
                {/* Owner, 21 Nov 2026: landmarks in a dropdown too. A jump
                    menu: pick one to fly there. */}
                <div className="kv-area">
                  <label className="kv-area-pill">
                    <Landmark size={16} aria-hidden className="kv-area-pin" />
                    <span className="sr-only">Fly to a landmark</span>
                    <select
                      className="kv-area-select"
                      defaultValue=""
                      onChange={(e) => {
                        const l = LANDMARKS.find((x) => x.id === e.target.value);
                        e.target.value = ''; // a jump menu: back to "Pick a landmark"
                        if (l) flyLandmark(l);
                      }}
                    >
                      <option value="">Pick a landmark</option>
                      <optgroup label="Ilorin places">
                        {LANDMARKS.filter((l) => l.place === 'Ilorin' && l.kind !== 'area').map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.short ?? l.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Ilorin areas">
                        {LANDMARKS.filter((l) => l.kind === 'area')
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Across Kwara">
                        {LANDMARKS.filter((l) => l.place !== 'Ilorin').map((l) => (
                          <option key={l.id} value={l.id}>
                            {(l.short ?? l.name) + ((l.short ?? l.name) === l.place ? '' : ` · ${l.place}`)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown size={15} aria-hidden className="kv-area-chev" />
                  </label>
                </div>
              </section>
              <div className="fm-sort">
                <span>Sort</span>
                <SegmentedControl
                  label="Sort stores"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'near', label: 'Nearest' },
                    { value: 'rating', label: 'Top rated' },
                    { value: 'name', label: 'A–Z' },
                  ]}
                />
              </div>
              {empty || list}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
