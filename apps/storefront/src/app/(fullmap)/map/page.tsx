// /map — full-screen store map of Ilorin (REDESIGN R4 §6). Server-renders
// the store list (only stores pinned inside Ilorin); the interactive map is a
// lazy client chunk. Outside the marketplace shell so the map is the page.
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import type { StoreRatingStats, StoreTheme } from '@idevtenancy/shared';
import { supabaseAnon } from '@/lib/supabase';
import { LISTED_EXAMPLE_VALUES } from '@/lib/flags';
import { inIlorin } from '@/lib/ilorin';
import { siteUrl } from '@/lib/site';
import type { FullMapStore } from '@/components/map/FullMap';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Map of stores in Ilorin',
  description: 'Find stores near you in Ilorin on a live map: open now, directions and WhatsApp in one tap.',
  alternates: { canonical: `${siteUrl()}/map` },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// The map (MapLibre + sheet) is a lazy chunk; the skeleton shows instantly.
const FullMap = dynamic(() => import('@/components/map/FullMap').then((m) => m.FullMap), {
  ssr: false,
  loading: () => (
    <div className="fm">
      <div className="fm-map-loading" aria-hidden />
      <div className="fm-sheet glass" style={{ transform: 'translateY(calc(100dvh - 176px))' }} aria-busy="true">
        <div className="fm-handle">
          <span className="fm-grabber" />
        </div>
        <div className="fm-sheet-head">
          <h1>Loading the map…</h1>
        </div>
        <div className="fm-peek">
          <div className="skeleton" style={{ width: 270, height: 70, borderRadius: 16 }} />
          <div className="skeleton" style={{ width: 270, height: 70, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  ),
});

type Row = Record<string, unknown> & {
  store_rating_stats?: Array<Pick<StoreRatingStats, 'review_count' | 'avg_stars'>> | Pick<StoreRatingStats, 'review_count' | 'avg_stars'> | null;
  store_themes?: Array<Pick<StoreTheme, 'logo_url' | 'favicon_url'>> | Pick<StoreTheme, 'logo_url' | 'favicon_url'> | null;
  whatsapp_settings?: Array<{ business_number: string }> | { business_number: string } | null;
};
const one = <T,>(v: T | T[] | null | undefined): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);

export default async function MapPage() {
  let stores: FullMapStore[] = [];
  try {
    const { data } = await supabaseAnon()
      .from('stores')
      .select(
        'id, slug, name, category, latitude, longitude, address, whatsapp_number, verification_status, is_example, business_hours, store_rating_stats(review_count, avg_stars), store_themes(logo_url, favicon_url), whatsapp_settings(business_number)',
      )
      .in('is_example', LISTED_EXAMPLE_VALUES)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1000);
    stores = ((data ?? []) as unknown as Row[])
      .map((s) => {
        const stats = one(s.store_rating_stats);
        const theme = one(s.store_themes);
        const wa = one(s.whatsapp_settings)?.business_number || (s.whatsapp_number as string) || null;
        return {
          id: String(s.id),
          slug: String(s.slug),
          name: String(s.name),
          category: String(s.category),
          lat: Number(s.latitude),
          lng: Number(s.longitude),
          address: (s.address as string) || null,
          logo: theme?.logo_url ?? theme?.favicon_url ?? null,
          verified: s.verification_status === 'verified',
          isExample: !!s.is_example,
          rating: stats?.avg_stars != null ? Number(stats.avg_stars) : null,
          reviewCount: stats?.review_count ?? null,
          whatsapp: wa,
          hours: (s.business_hours as FullMapStore['hours']) ?? null,
        };
      })
      .filter((s) => inIlorin(s.lat, s.lng));
  } catch {
    stores = []; // the page still renders; the map shows its empty state
  }
  return <FullMap stores={stores} />;
}
