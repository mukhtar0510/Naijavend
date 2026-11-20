// Kwaravend's map is Ilorin-only: the view opens on the city, panning is
// held to the metro area, and stores pinned outside it are not plotted.
// Server- and client-safe (no 'use client'), so the Discover page count and
// the map agree on what "in Ilorin" means.

export const ILORIN_CENTER: [number, number] = [8.4966, 4.5421]; // [lat, lng], city centre

/** [[south, west], [north, east]] — Ilorin West/East/South LGAs with a small margin. */
export const ILORIN_BOUNDS: [[number, number], [number, number]] = [
  [8.33, 4.38],
  [8.66, 4.74],
];

/** Lowest zoom the map allows: the whole city fits, nothing beyond it. */
export const ILORIN_MIN_ZOOM = 10.5;

export function inIlorin(lat: number, lng: number): boolean {
  const [[s, w], [n, e]] = ILORIN_BOUNDS;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}
