// Store preview for the full map: what a store's own site (/s/[slug]) looks
// like, from the same rows that page reads (stores, store_themes, listings).
// Public data only, read with the anon key so RLS decides what is visible.
// The request carries the store slug and nothing about the buyer.
import { NextRequest } from 'next/server';
import { BACKGROUND_GRADIENTS, isBackgroundGradient, type Listing, type StoreTheme } from '@idevtenancy/shared';
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { FEATURES } from '@/lib/flags';
import { allowedLayout } from '@/lib/store-layout';

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const httpsOnly = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 1000;

export interface StorePreviewData {
  name: string;
  slug: string;
  description: string | null;
  announcement: string | null;
  isExample: boolean;
  logo: string | null;
  theme: {
    layout: string;
    accent: string;
    accentText: string;
    background: string;
    backgroundGradient: string | null;
    text: string | null;
    heading: string | null;
    muted: string | null;
    fontHeading: string;
    fontBody: string;
    buttons: string;
    heroBanner: string | null;
    heroBg: string | null;
    listingBg: string | null;
    listingText: string | null;
  };
  gallery: string[];
  listings: Array<{ id: string; title: string; priceKobo: number; type: string; cover: string | null; video: string | null }>;
  listingCount: number;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!SLUG.test(slug)) return apiError(400, 'bad_slug', 'Unknown store.');
  try {
    const sb = supabaseAnon();
    const { data: store } = await sb
      .from('stores')
      .select('id, name, slug, description, announcement, is_example, plan, plan_expires_at')
      .eq('slug', slug)
      .maybeSingle();
    if (!store || (store.is_example && !FEATURES.exampleStores)) return apiError(404, 'not_found', 'Store not found.');

    const [{ data: themeRow }, { data: rows, count }] = await Promise.all([
      sb.from('store_themes').select('*').eq('store_id', store.id).maybeSingle(),
      sb
        .from('listings')
        .select('id, title, price_kobo, type, image_urls, video_url', { count: 'exact' })
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);
    const t = (themeRow ?? null) as StoreTheme | null;

    const data: StorePreviewData = {
      name: store.name,
      slug: store.slug,
      description: store.description ?? null,
      announcement: store.announcement ?? null,
      isExample: !!store.is_example,
      logo: [t?.logo_url, t?.favicon_url].find(httpsOnly) ?? null,
      theme: {
        layout: allowedLayout(t?.layout, store),
        accent: t?.accent_color ?? '#1D4ED8',
        accentText: t?.accent_text ?? '#FFFFFF',
        background: t?.background_color ?? '#FFFFFF',
        backgroundGradient: t?.background_gradient && isBackgroundGradient(t.background_gradient) ? BACKGROUND_GRADIENTS[t.background_gradient] : null,
        text: t?.text_color ?? null,
        heading: t?.heading_color ?? null,
        muted: t?.muted_color ?? null,
        fontHeading: t?.font_heading ?? 'Sora',
        fontBody: t?.font_body ?? 'Inter',
        buttons: t?.button_shape ?? 'rounded',
        heroBanner: t?.hero_style === 'image' && httpsOnly(t?.banner_url) ? t!.banner_url : null,
        heroBg: t?.hero_bg_color ?? null,
        listingBg: t?.listing_bg_color ?? null,
        listingText: t?.listing_color ?? null,
      },
      gallery: (Array.isArray(t?.gallery_urls) ? t!.gallery_urls! : []).filter(httpsOnly).slice(0, 5),
      listings: ((rows ?? []) as Array<Pick<Listing, 'id' | 'title' | 'price_kobo' | 'type' | 'image_urls' | 'video_url'>>).map((l) => ({
        id: l.id,
        title: l.title,
        priceKobo: l.price_kobo,
        type: l.type,
        cover: (l.image_urls ?? []).find(httpsOnly) ?? null,
        video: httpsOnly(l.video_url) ? l.video_url : null,
      })),
      listingCount: count ?? rows?.length ?? 0,
    };
    const res = apiOk(data);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (err) {
    return internalError('map-store-preview', err);
  }
}
