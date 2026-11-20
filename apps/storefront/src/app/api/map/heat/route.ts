// Map heat layer data (REDESIGN 6.1): where in Ilorin people have been looking
// at stores in the last 24 hours. Aggregated and anonymised:
//  - only store-level events (store page views, shares, chats, map taps) —
//    never a buyer's position, never an individual order point;
//  - counted per ~450 m grid cell around the STORE's public location;
//  - a cell only appears once it has at least MIN_EVENTS events;
//  - example (sample-data) stores are excluded.
import { supabaseServiceOptional } from '@/lib/supabase';
import { apiOk } from '@/lib/api';
import { inIlorin } from '@/lib/ilorin';

export const revalidate = 300; // recompute at most every 5 minutes

const MIN_EVENTS = 5;
const CELL = 0.004; // degrees ≈ 450 m at Ilorin's latitude
const DAY_MS = 24 * 60 * 60 * 1000;

interface Cell {
  lat: number;
  lng: number;
  count: number;
}

export async function GET() {
  const sb = supabaseServiceOptional();
  if (!sb) return apiOk({ cells: [] as Cell[], windowHours: 24, minEvents: MIN_EVENTS });
  const since = new Date(Date.now() - DAY_MS).toISOString();

  try {
    const { data: stores } = await sb
      .from('stores')
      .select('id, latitude, longitude')
      .eq('is_example', false)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    const where = new Map<string, { lat: number; lng: number }>();
    for (const s of stores ?? []) {
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (inIlorin(lat, lng)) where.set(String(s.id), { lat, lng });
    }
    if (where.size === 0) return apiOk({ cells: [] as Cell[], windowHours: 24, minEvents: MIN_EVENTS });

    const ids = [...where.keys()];
    const [{ data: views }, mapTaps] = await Promise.all([
      sb.from('store_events').select('store_id').gte('created_at', since).in('store_id', ids).limit(20000),
      sb
        .from('map_events')
        .select('store_id')
        .gte('created_at', since)
        .in('store_id', ids)
        .limit(20000)
        .then((r) => r.data ?? [], () => []), // table may not exist yet
    ]);

    const cells = new Map<string, Cell>();
    for (const row of [...(views ?? []), ...mapTaps]) {
      const p = where.get(String(row.store_id));
      if (!p) continue;
      const cy = Math.round(p.lat / CELL);
      const cx = Math.round(p.lng / CELL);
      const key = `${cy}:${cx}`;
      const c = cells.get(key) ?? { lat: cy * CELL, lng: cx * CELL, count: 0 };
      c.count += 1;
      cells.set(key, c);
    }
    const out = [...cells.values()].filter((c) => c.count >= MIN_EVENTS);
    return apiOk({ cells: out, windowHours: 24, minEvents: MIN_EVENTS });
  } catch {
    return apiOk({ cells: [] as Cell[], windowHours: 24, minEvents: MIN_EVENTS });
  }
}
