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

/**
 * Kwara State (owner decision, 21 Nov 2026): the store MAP may pan across
 * Kwara so state landmarks (KWASU Malete, Offa, Jebba...) are visible. STORES
 * stay Ilorin-only (inIlorin); the map still opens on Ilorin.
 */
export const KWARA_BOUNDS: [[number, number], [number, number]] = [
  [7.75, 2.65],
  [10.2, 6.25],
];
export const KWARA_MIN_ZOOM = 7;

export function inKwara(lat: number, lng: number): boolean {
  const [[s, w], [n, e]] = KWARA_BOUNDS;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

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
  // Added 21 Nov 2026 (owner: "add places like Asadam"). Centres are
  // APPROXIMATE unless noted — check each on the map and adjust. Points marked
  // OSM reuse a real OpenStreetMap landmark from lib/landmarks.ts.
  { id: 'asa-dam', label: 'Asa-Dam', lat: 8.464, lng: 4.52 },
  { id: 'mandate', label: 'Mandate', lat: 8.4752, lng: 4.5058 }, // OSM: Mandate Market
  { id: 'unity', label: 'Unity', lat: 8.4855, lng: 4.552 },
  { id: 'ajikobi', label: 'Ajikobi', lat: 8.499, lng: 4.541 },
  { id: 'surulere', label: 'Surulere', lat: 8.504, lng: 4.537 },
  { id: 'pipeline', label: 'Pipeline', lat: 8.478, lng: 4.608 },
  { id: 'kulende', label: 'Kulende', lat: 8.469, lng: 4.588 },
  { id: 'olunlade', label: 'Olunlade', lat: 8.4935, lng: 4.5735 },
  { id: 'ganmo', label: 'Ganmo', lat: 8.415, lng: 4.605 },
  { id: 'sabo-oke', label: 'Sabo-Oke', lat: 8.499, lng: 4.556 },
  { id: 'agbo-oba', label: 'Agbo-Oba', lat: 8.5015, lng: 4.545 },
  { id: 'pakata', label: 'Pakata', lat: 8.503, lng: 4.55 },
  { id: 'oloje', label: 'Oloje', lat: 8.515, lng: 4.532 },
  { id: 'okelele', label: 'Okelele', lat: 8.506, lng: 4.56 },
  { id: 'amilegbe', label: 'Amilegbe', lat: 8.488, lng: 4.56 },
  { id: 'gaa-odota', label: 'Gaa-Odota', lat: 8.47, lng: 4.548 },
  { id: 'irewolede', label: 'Irewolede', lat: 8.457, lng: 4.56 },
  { id: 'airport-road', label: 'Airport Road', lat: 8.45, lng: 4.505 },
  { id: 'eyenkorin', label: 'Eyenkorin', lat: 8.46, lng: 4.475 },
  { id: 'unilorin', label: 'Unilorin area', lat: 8.4768, lng: 4.6585 }, // OSM: University of Ilorin
  { id: 'kwara-poly', label: 'Kwara Poly area', lat: 8.5433, lng: 4.6343 }, // OSM: Kwara State Polytechnic
];

/** Areas in A–Z order, for dropdowns. */
export const ILORIN_AREAS_SORTED = [...ILORIN_AREAS].sort((a, b) => a.label.localeCompare(b.label));

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
