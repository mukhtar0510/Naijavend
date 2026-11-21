// Shared MapLibre map factory — one place that decides basemap styles,
// theming and controls for every map in the app (store locator, store-page
// embeds). Client-only: maplibre-gl is imported dynamically at call time.
'use client';

import type { Map as MlMap } from 'maplibre-gl';

export interface ThemedMapOptions {
  /** [lat, lng] — kept lat-first like the rest of the app; converted inside. */
  center: [number, number];
  zoom: number;
  /** Use the dark vector style. Default: follow the app's data-theme. */
  dark?: boolean;
  /** Show the +/- / compass control (top-left). Default: false. */
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  /** Hard pan limit as [[south, west], [north, east]], e.g. one state. */
  maxBounds?: [[number, number], [number, number]];
  /** Lowest allowed zoom (keeps the view from leaving the bounded city). */
  minZoom?: number;
  /** Add a Streets / Satellite switch control (top-right). Default: false. */
  layerSwitch?: boolean;
}

export type BaseLayerId = 'streets' | 'satellite';

// OpenFreeMap "liberty": free, keyless OpenStreetMap vector tiles. One style
// for both themes, recoloured on load to the Kwaravend map palette
// Blue and black (owner decision): a clean blue-white map in light mode, a
// black-and-navy map with blue roads and water in dark mode.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MAP_PALETTE = {
  light: {
    land: '#EEF3FB', water: '#B9D3F7', park: '#D4EEDF', building: '#E1E8F4',
    road: '#FFFFFF', casing: '#C9D5EA', rail: '#B8C6DE', label: '#0A0F1A', halo: '#FFFFFF', waterLabel: '#1E4FAF',
  },
  dark: {
    land: '#06080F', water: '#0A1E45', park: '#0A1A16', building: '#0F1626',
    road: '#16264A', casing: '#04060C', rail: '#1C2B4D', label: '#DCE6FA', halo: '#06080F', waterLabel: '#7AA8FF',
  },
} as const;

/** Recolour the liberty style to the Kwaravend palette (call after style.load). */
export function applyKwaraStyle(map: MlMap, dark: boolean) {
  const c = dark ? MAP_PALETTE.dark : MAP_PALETTE.light;
  const set = (id: string, prop: string, value: unknown) => {
    try {
      map.setPaintProperty(id, prop as never, value as never);
    } catch {
      /* layer without that property */
    }
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (layer.type === 'background') set(id, 'background-color', c.land);
    else if (layer.type === 'raster' && id !== SAT_LAYER) map.setLayoutProperty(id, 'visibility', 'none');
    else if (layer.type === 'fill') {
      if (id === 'road_area_pattern') map.setLayoutProperty(id, 'visibility', 'none');
      else if (id === 'water') set(id, 'fill-color', c.water);
      else if (id === 'building') set(id, 'fill-color', c.building), set(id, 'fill-outline-color', c.casing);
      else if (/park|wood|grass|pitch|cemetery|wetland/.test(id)) set(id, 'fill-color', c.park), set(id, 'fill-opacity', 1);
      else set(id, 'fill-color', c.land);
    } else if (layer.type === 'line') {
      if (/^waterway/.test(id)) set(id, 'line-color', c.water);
      else if (/park_outline/.test(id)) set(id, 'line-color', c.park);
      else if (/rail|hatching/.test(id)) set(id, 'line-color', c.rail);
      else if (/casing/.test(id)) set(id, 'line-color', c.casing);
      else if (/^(road|tunnel|bridge)_/.test(id)) set(id, 'line-color', c.road);
    } else if (layer.type === 'symbol') {
      set(id, 'text-color', /^water/.test(id) ? c.waterLabel : c.label);
      set(id, 'text-halo-color', c.halo);
      set(id, 'text-halo-width', 1.4);
    } else if (layer.type === 'fill-extrusion') {
      set(id, 'fill-extrusion-color', c.building);
      map.setLayoutProperty(id, 'visibility', 'none'); // 3D buildings are opt-in
    }
  }
}

/** Whether this device can comfortably render 3D buildings. */
export function canShow3D(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 2;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return cores >= 6 && mem >= 4 && !saveData;
}

/** Toggle the extruded-buildings layer and tilt the camera to show it. */
export function setBuildings3D(map: MlMap, on: boolean) {
  if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', on ? 'visible' : 'none');
  map.easeTo({ pitch: on ? 50 : 0, duration: 600 });
}

// Esri World Imagery — keyless satellite raster. Inserted *under* the label
// layers, so satellite view keeps street and place names (a "hybrid" map).
// Useful in Ilorin where many shops sit on unnamed streets.
const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_SOURCE = 'nv-satellite';
const SAT_LAYER = 'nv-satellite';

export function prefersDarkMap(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** A MapLibre map with a programmatic base-layer switch. */
export type ThemedMap = MlMap & { setBaseLayer: (id: BaseLayerId) => void };

/** [lat, lng] → MapLibre's [lng, lat]. */
export const ll = (lat: number, lng: number): [number, number] => [lng, lat];

/**
 * Creates a themed MapLibre map on `el` and resolves once its style has
 * loaded (so callers can add sources/layers straight away). The caller owns
 * adding markers/layers and calling `map.remove()` on unmount.
 */
export async function createThemedMap(el: HTMLElement, opts: ThemedMapOptions): Promise<ThemedMap> {
  const maplibregl = await import('maplibre-gl');
  // v6's worker is a separate module file that webpack doesn't emit; it is
  // copied to /public/maplibre by scripts/copy-maplibre-worker.mjs.
  maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
  const dark = opts.dark ?? prefersDarkMap();

  const map = new maplibregl.Map({
    container: el,
    style: STYLE_URL,
    center: ll(opts.center[0], opts.center[1]),
    zoom: opts.zoom,
    scrollZoom: opts.scrollWheelZoom ?? false,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    ...(opts.minZoom != null ? { minZoom: opts.minZoom } : {}),
    ...(opts.maxBounds
      ? {
          maxBounds: [
            ll(opts.maxBounds[0][0], opts.maxBounds[0][1]),
            ll(opts.maxBounds[1][0], opts.maxBounds[1][1]),
          ] as [[number, number], [number, number]],
        }
      : {}),
  }) as ThemedMap;
  map.touchZoomRotate.disableRotation();

  if (opts.zoomControl) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  }

  // Resolve as soon as the *style* is ready (enough to add sources, layers
  // and markers) rather than on 'load', which also waits for every first-view
  // tile — on slow Nigerian mobile data that left pins missing for ages.
  // (isStyleLoaded() also waits on sources/tiles, so listen for 'style.load'.)
  await new Promise<void>((resolve) => {
    const style = (map as unknown as { style?: { _loaded?: boolean } }).style;
    if (style?._loaded) return resolve();
    map.once('style.load', () => resolve());
  });

  applyKwaraStyle(map, dark);

  // Satellite raster sits just below the first label layer, hidden until used.
  const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
  map.addSource(SAT_SOURCE, {
    type: 'raster',
    tiles: [SATELLITE_URL],
    tileSize: 256,
    maxzoom: 18,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  });
  map.addLayer(
    { id: SAT_LAYER, type: 'raster', source: SAT_SOURCE, layout: { visibility: 'none' } },
    firstSymbol,
  );

  let current: BaseLayerId = 'streets';
  const switchBtns: HTMLButtonElement[] = [];
  map.setBaseLayer = (id: BaseLayerId) => {
    current = id;
    if (map.getLayer(SAT_LAYER)) map.setLayoutProperty(SAT_LAYER, 'visibility', id === 'satellite' ? 'visible' : 'none');
    for (const b of switchBtns) b.setAttribute('aria-pressed', String(b.dataset.layer === current));
  };

  if (opts.layerSwitch) {
    const box = document.createElement('div');
    box.className = 'maplibregl-ctrl nv-ml-switch';
    for (const [id, label] of [
      ['streets', 'Streets'],
      ['satellite', 'Satellite'],
    ] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.layer = id;
      b.setAttribute('aria-pressed', String(id === current));
      b.addEventListener('click', () => map.setBaseLayer(id));
      switchBtns.push(b);
      box.appendChild(b);
    }
    map.addControl({ onAdd: () => box, onRemove: () => box.remove() }, 'top-right');
  }

  return map;
}

/** GeoJSON circle polygon (for radius rings) — MapLibre has no circle-in-metres primitive. */
export function circlePolygon(lat: number, lng: number, km: number, steps = 72): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}
