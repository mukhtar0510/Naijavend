// Road routes for the store maps (Discover locator and the full /map).
// Uses the FOSSGIS OSRM servers at routing.openstreetmap.de, which route real
// foot, bike and car paths (the project-osrm demo only routes cars). Falls back
// to a dashed straight line when the router can't be reached.
//
// Privacy: a route request sends both points (the buyer's position and the
// store's) to that routing service. Only call it after the buyer asks for a
// route, and say so in the UI.

export type Profile = 'foot' | 'bike' | 'driving';

export const PROFILES: Record<Profile, { label: string; verb: string; kmh: number; router: string }> = {
  foot: { label: 'Walk', verb: 'walk', kmh: 4.8, router: 'routed-foot' },
  bike: { label: 'Okada', verb: 'ride', kmh: 18, router: 'routed-bike' },
  driving: { label: 'Drive', verb: 'drive', kmh: 22, router: 'routed-car' },
};

export interface RouteStep {
  text: string;
  m: number;
}

/** A fetched road route or the straight-line fallback. */
export interface RouteInfo {
  km: number;
  min: number;
  real: boolean; // false → straight-line fallback
  profile: Profile;
  /** [lat, lng] pairs. */
  coords: [number, number][];
  steps: RouteStep[];
}

export type LatLng = { lat: number; lng: number };

/** Plain-language turn instruction for an OSRM step. */
export function stepText(step: {
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

/** Straight-line distance in km (used for the fallback line). */
function straightKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Fetch a route; on any failure (offline, timeout, no route) returns the
 * straight-line fallback so the map always shows something honest.
 * Rejects only when `signal` is aborted by the caller.
 */
export async function fetchRoute(from: LatLng, to: LatLng, profile: Profile, signal?: AbortSignal, timeoutMs = 8000): Promise<RouteInfo> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(
      `https://routing.openstreetmap.de/${PROFILES[profile].router}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`,
      { signal: ctrl.signal },
    );
    const body = await res.json();
    const r = body?.routes?.[0];
    if (res.ok && r?.geometry?.coordinates?.length > 1) {
      return {
        km: r.distance / 1000,
        min: Math.max(1, Math.round(r.duration / 60)),
        real: true,
        profile,
        coords: r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
        steps: (r.legs?.[0]?.steps ?? []).map(stepText).filter(Boolean) as RouteStep[],
      };
    }
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const km = straightKm(from, to);
  return {
    km,
    min: Math.max(1, Math.round((km / PROFILES[profile].kmh) * 60)),
    real: false,
    profile,
    coords: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    steps: [],
  };
}
