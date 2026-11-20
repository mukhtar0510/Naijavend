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

/**
 * Ilorin area seed (REDESIGN 6.1 "area quick-jump"). Approximate centres of
 * well-known districts, used to fly the map and group the offline list.
 * The only place city geography lives besides ILORIN_BOUNDS / ILORIN_CENTER.
 */
export const ILORIN_AREAS: ReadonlyArray<{ id: string; label: string; lat: number; lng: number }> = [
  { id: 'centre', label: 'Ilorin centre', lat: 8.4966, lng: 4.5421 },
  { id: 'taiwo-road', label: 'Taiwo Road', lat: 8.4935, lng: 4.5486 },
  { id: 'post-office', label: 'Post Office', lat: 8.4921, lng: 4.5428 },
  { id: 'gra', label: 'GRA', lat: 8.5005, lng: 4.5652 },
  { id: 'fate', label: 'Fate', lat: 8.5132, lng: 4.5703 },
  { id: 'ipata', label: 'Ipata', lat: 8.5086, lng: 4.5548 },
  { id: 'oja-oba', label: 'Oja Oba', lat: 8.4987, lng: 4.5468 },
  { id: 'tanke', label: 'Tanke', lat: 8.4752, lng: 4.6012 },
  { id: 'oke-odo', label: 'Oke-Odo', lat: 8.4806, lng: 4.6184 },
  { id: 'challenge', label: 'Challenge', lat: 8.4612, lng: 4.5569 },
  { id: 'gaa-akanbi', label: 'Gaa Akanbi', lat: 8.4559, lng: 4.5452 },
  { id: 'offa-garage', label: 'Offa Garage', lat: 8.4796, lng: 4.5702 },
  { id: 'basin', label: 'Basin', lat: 8.4725, lng: 4.5935 },
  { id: 'sango', label: 'Sango', lat: 8.4885, lng: 4.5925 },
  { id: 'adewole', label: 'Adewole', lat: 8.4718, lng: 4.5333 },
];

/** Nearest seeded area to a point (for grouping and "near …" labels). */
export function nearestArea(lat: number, lng: number) {
  let best = ILORIN_AREAS[0];
  let bestD = Infinity;
  for (const a of ILORIN_AREAS) {
    const d = (a.lat - lat) ** 2 + ((a.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
