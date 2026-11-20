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

// OpenFreeMap: free, keyless OpenStreetMap vector tiles with real light and
// dark styles (no CSS filter tricks, crisp labels at any zoom).
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

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
    style: dark ? STYLES.dark : STYLES.light,
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
