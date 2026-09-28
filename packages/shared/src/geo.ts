/** Geodesic helpers for store-distance features (no external deps). */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Human distance: metres under 1 km, otherwise km with one decimal. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000 / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Rough travel-time estimates from straight-line distance (Lagos-style city
 * factor: real roads are ~1.3× the crow-flies distance).
 */
export function travelEstimates(km: number): { walk: string; drive: string } {
  const roadKm = km * 1.3;
  const walkMin = (roadKm / 4.8) * 60; // ~4.8 km/h
  const driveMin = (roadKm / 22) * 60; // ~22 km/h city average
  const fmt = (min: number) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : `${Math.round(min / 60)} h ${Math.round(min % 60)} min`);
  return { walk: fmt(walkMin), drive: fmt(driveMin) };
}

/**
 * Initial bearing from point a to point b, in degrees clockwise from true
 * north (0 = north, 90 = east). Used to place stores on the radar locator.
 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Google Maps directions URL from the user's point to the store. */
export function directionsUrl(from: LatLng | null, to: LatLng, name: string): string {
  const dest = `${to.lat},${to.lng}`;
  const origin = from ? `${from.lat},${from.lng}` : undefined;
  const q = encodeURIComponent(name);
  return origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}(${q})`;
}
