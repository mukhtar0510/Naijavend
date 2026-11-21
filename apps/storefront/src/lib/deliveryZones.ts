// Landmark delivery zones (owner request, 21 Nov 2026): sellers can deliver to
// campuses and big landmarks (Unilorin, KWASU, TAU, Kwara Mall…) at their own
// fee, and create discount codes that only work for one zone.
//
// Stored inside stores.delivery_options as
//   { …pickup/rider/courier…, zones: { [landmarkId]: { enabled, fee_kobo } } }
// Orders that use a zone have delivery_method = 'zone' and delivery_zone = id.
// Server-only rules (fee and zone-limited codes) are enforced in create-order.

import { LANDMARKS, type Landmark } from './landmarks';

export const ZONE_LANDMARKS: readonly Landmark[] = LANDMARKS.filter((l) => l.deliveryZone);
const ZONE_IDS = new Set(ZONE_LANDMARKS.map((l) => l.id));

export type ZoneMap = Record<string, { enabled: boolean; fee_kobo: number }>;

export function isZoneId(id: unknown): id is string {
  return typeof id === 'string' && ZONE_IDS.has(id);
}

export function zoneLabel(id: string | null | undefined): string {
  const l = ZONE_LANDMARKS.find((z) => z.id === id);
  return l ? `${l.short ?? l.name}${l.place && l.place !== 'Ilorin' ? `, ${l.place}` : ''}` : '';
}

/** Read the zone map out of a store's delivery_options (tolerates legacy shapes). */
export function zonesOf(deliveryOptions: unknown): ZoneMap {
  const raw = (deliveryOptions as { zones?: unknown } | null)?.zones;
  if (!raw || typeof raw !== 'object') return {};
  const out: ZoneMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isZoneId(id) || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const fee = Number(o.fee_kobo);
    out[id] = {
      enabled: o.enabled === true,
      fee_kobo: Number.isFinite(fee) ? Math.min(100_000_000, Math.max(0, Math.round(fee))) : 0,
    };
  }
  return out;
}

/** Enabled zones for buyers, in landmark order. */
export function enabledZones(deliveryOptions: unknown): Array<{ id: string; label: string; feeKobo: number }> {
  const z = zonesOf(deliveryOptions);
  return ZONE_LANDMARKS.filter((l) => z[l.id]?.enabled).map((l) => ({
    id: l.id,
    label: zoneLabel(l.id),
    feeKobo: z[l.id].fee_kobo,
  }));
}
