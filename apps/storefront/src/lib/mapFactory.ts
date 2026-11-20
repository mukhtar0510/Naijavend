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
  /** Hard pan limit, e.g. one state. Pins outside it are unreachable. */
  maxBounds?: [[number, number], [number, number]];
  /** Add a Streets / Satellite switch (top-right). Default: false. */
  layerSwitch?: boolean;
}

export type BaseLayerId = 'streets' | 'satellite';

// Esri World Imagery — keyless satellite tiles (attribution required). Useful
// in Ilorin where many shops sit on unnamed streets: buyers recognise the roof.
const SATELLITE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
} as const;

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

/** A Leaflet map with a programmatic base-layer switch. */
export type ThemedMap = import('leaflet').Map & { setBaseLayer?: (id: BaseLayerId) => void };

/**
 * Creates a themed Leaflet map on `el`. Returns the map instance; the caller
 * owns adding markers/layers and destroying it on unmount.
 */
export async function createThemedMap(
  el: HTMLElement,
  opts: LeafletMapOptions
): Promise<ThemedMap> {
  const L = (await import('leaflet')).default;
  const dark = opts.dark ?? prefersDarkMap();
  const tiles = dark ? TILES.dark : TILES.light;

  const map = L.map(el, {
    center: opts.center,
    zoom: opts.zoom,
    zoomControl: opts.zoomControl ?? false,
    scrollWheelZoom: opts.scrollWheelZoom ?? false,
    attributionControl: true,
    ...(opts.maxBounds
      ? { maxBounds: opts.maxBounds, maxBoundsViscosity: 0.9, minZoom: 7 }
      : {}),
  });

  const attribution = (a: string) => (opts.attributionPrefix ? `${opts.attributionPrefix} · ${a}` : a);
  // OSM standard tiles have no {s} subdomains; keep default single-host.
  const streets = L.tileLayer(tiles.url, { maxZoom: 19, attribution: attribution(tiles.attribution) });
  const satellite = L.tileLayer(SATELLITE.url, { maxZoom: 19, maxNativeZoom: 18, attribution: attribution(SATELLITE.attribution) });
  streets.addTo(map);

  // Dark cartography: filter the tile pane (not markers/overlays) to a dark
  // scheme. Never filter satellite imagery — inverted photos are unreadable.
  const pane = map.getPane('tilePane');
  const syncDark = (layer: BaseLayerId) => pane?.classList.toggle('map-tiles-dark', dark && layer === 'streets');
  syncDark('streets');

  const layers: Record<BaseLayerId, import('leaflet').TileLayer> = { streets, satellite };
  (map as ThemedMap).setBaseLayer = (id: BaseLayerId) => {
    for (const [k, l] of Object.entries(layers)) {
      if (k === id) { if (!map.hasLayer(l)) l.addTo(map); }
      else if (map.hasLayer(l)) map.removeLayer(l);
    }
    syncDark(id);
  };

  if (opts.layerSwitch) {
    L.control
      .layers({ Streets: streets, Satellite: satellite }, undefined, { position: 'topright', collapsed: false })
      .addTo(map);
    map.on('baselayerchange', (e: import('leaflet').LayersControlEvent) =>
      syncDark(e.layer === satellite ? 'satellite' : 'streets'),
    );
  }

  return map as ThemedMap;
}
