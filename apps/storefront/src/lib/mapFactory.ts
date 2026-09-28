// Shared Leaflet map factory — one place that decides tiles, theming and
// controls for every map in the app (store locator, store-page embeds).
// Client-only: import dynamic ('leaflet') at call time.
'use client';

export interface LeafletMapOptions {
  center: [number, number];
  zoom: number;
  /** Use dark cartography when the app is in dark mode. Default: auto-detect. */
  dark?: boolean;
  /** Show the Leaflet zoom +/- control (hidden by default; pinch/buttons suffice). */
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  /** Extra padding-bottom-right for attribution over overlays. */
  attributionPrefix?: string;
}

// CARTO basemaps now watermark free usage with "API KEY REQUIRED", so tiles
// come from OpenStreetMap's standard tile server (free, keyless, attribution
// required). Dark mode applies a CSS filter to the tile pane (invert + hue)
// instead of a separate dark tile set — no API keys, no watermarks.
const TILES = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
} as const;

export function prefersDarkMap(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Creates a themed Leaflet map on `el`. Returns the map instance; the caller
 * owns adding markers/layers and destroying it on unmount.
 */
export async function createThemedMap(
  el: HTMLElement,
  opts: LeafletMapOptions
): Promise<import('leaflet').Map> {
  const L = (await import('leaflet')).default;
  const dark = opts.dark ?? prefersDarkMap();
  const tiles = dark ? TILES.dark : TILES.light;

  const map = L.map(el, {
    center: opts.center,
    zoom: opts.zoom,
    zoomControl: opts.zoomControl ?? false,
    scrollWheelZoom: opts.scrollWheelZoom ?? false,
    attributionControl: true,
  });

  L.tileLayer(tiles.url, {
    maxZoom: 19,
    // OSM standard tiles have no {s} subdomains; keep default single-host.
    attribution: opts.attributionPrefix
      ? `${opts.attributionPrefix} · ${tiles.attribution}`
      : tiles.attribution,
  }).addTo(map);

  // Dark cartography: filter the tile pane (not markers/overlays) to a dark
  // scheme. Class removed automatically with the pane on map removal.
  if (dark) {
    const pane = map.getPane('tilePane');
    if (pane) pane.classList.add('map-tiles-dark');
  }

  return map;
}
