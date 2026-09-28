// Store settings — location pin, WhatsApp config and store appearance (theme).
// RLS scopes writes to the owner.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { revalidateStore } from '@/lib/revalidate';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText, isValidPhone, isValidHexColor, isStoreCategory, categoryLabel, isStoreFont, isStoreLayout, LISTING_STYLES, HOVER_ANIMS } from '@idevtenancy/shared';

const HEX = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FONT_NAMES = new Set<string>(['Sora', 'Inter', 'Playfair Display', 'DM Sans', 'Space Grotesk', 'Manrope', 'Outfit', 'Plus Jakarta Sans', 'Urbanist', 'Merriweather', 'Lora', 'Libre Baskerville', 'Fraunces', 'Cormorant Garamond', 'Bricolage Grotesque', 'Bebas Neue', 'Unbounded', 'Oswald', 'Dancing Script', 'Pacifico', 'Great Vibes', 'Satisfy', 'Caveat'].filter(isStoreFont));
const LAYOUTS = new Set<string>(['modern', 'classic', 'bold', 'minimal', 'boutique', 'merchant', 'luxury', 'playful', 'sunset', 'marketplace', 'editorial', 'neon', 'pastel', 'monochrome', 'showcase', 'festival', 'artisan', 'executive', 'aurora', 'corner'].filter(isStoreLayout));
const HERO_STYLES = new Set(['gradient', 'image', 'solid']);
const BUTTON_SHAPES = new Set(['pill', 'rounded', 'square']);
const CARD_STYLES = new Set(['soft', 'outline', 'shadow']);
const CARD_RADII = new Set(['sharp', 'rounded']);
const LISTING_STYLE_SET = new Set<string>(LISTING_STYLES);
const HOVER_ANIM_SET = new Set<string>(HOVER_ANIMS);

// Validates a per-day open/close map; every present day must have two HH:MM times
// with close strictly after open. Anything off returns undefined (keep old value).
function safeHours(v: unknown): Record<string, [string, string]> | undefined {
  if (v === null) return {};
  if (typeof v !== 'object' || v === null) return undefined;
  const raw = v as Record<string, unknown>;
  const out: Record<string, [string, string]> = {};
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const range = raw[day];
    if (range == null) continue;
    if (
      Array.isArray(range) &&
      range.length === 2 &&
      typeof range[0] === 'string' &&
      typeof range[1] === 'string' &&
      TIME_RE.test(range[0]) &&
      TIME_RE.test(range[1]) &&
      range[1] > range[0]
    ) {
      out[day] = [range[0], range[1]];
    }
  }
  return out;
}

function safeUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return s;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;

  const address = sanitizeText(b.address, 300);
  const latitude = typeof b.latitude === 'number' && b.latitude >= -90 && b.latitude <= 90 ? b.latitude : null;
  const longitude = typeof b.longitude === 'number' && b.longitude >= -180 && b.longitude <= 180 ? b.longitude : null;
  const whatsappNumber = sanitizeText(b.whatsappNumber, 16);
  const greetingMessage = sanitizeText(b.greetingMessage, 300);
  const catalogEnabled = b.catalogEnabled === true;

  // Appearance / theme fields (all optional).
  const accentColor = typeof b.accentColor === 'string' && HEX.test(b.accentColor) ? b.accentColor : undefined;
  const accentSoft = typeof b.accentSoft === 'string' && HEX.test(b.accentSoft) ? b.accentSoft : undefined;
  const accentText = typeof b.accentText === 'string' && HEX.test(b.accentText) ? b.accentText : undefined;
  const backgroundColor = typeof b.backgroundColor === 'string' && HEX.test(b.backgroundColor) ? b.backgroundColor : undefined;
  const fontHeading = typeof b.fontHeading === 'string' && FONT_NAMES.has(b.fontHeading) ? b.fontHeading : undefined;
  const fontBody = typeof b.fontBody === 'string' && FONT_NAMES.has(b.fontBody) ? b.fontBody : undefined;
  const layout = typeof b.layout === 'string' && LAYOUTS.has(b.layout) ? b.layout : undefined;
  const heroStyle = typeof b.heroStyle === 'string' && HERO_STYLES.has(b.heroStyle) ? b.heroStyle : undefined;
  const textColor = b.textColor === undefined ? undefined : (typeof b.textColor === 'string' && HEX.test(b.textColor) ? b.textColor : null);
  const headingColor = b.headingColor === undefined ? undefined : (typeof b.headingColor === 'string' && HEX.test(b.headingColor) ? b.headingColor : null);
  const mutedColor = b.mutedColor === undefined ? undefined : (typeof b.mutedColor === 'string' && HEX.test(b.mutedColor) ? b.mutedColor : null);
  const buttonShape = typeof b.buttonShape === 'string' && BUTTON_SHAPES.has(b.buttonShape) ? b.buttonShape : undefined;
  const cardStyle = typeof b.cardStyle === 'string' && CARD_STYLES.has(b.cardStyle) ? b.cardStyle : undefined;
  // Listing-card colours: string = set, anything else (null/false/'') = clear.
  const listingColor = b.listingColor === undefined ? undefined : (typeof b.listingColor === 'string' && HEX.test(b.listingColor) ? b.listingColor : null);
  const listingBgColor = b.listingBgColor === undefined ? undefined : (typeof b.listingBgColor === 'string' && HEX.test(b.listingBgColor) ? b.listingBgColor : null);
  const cardRadius = typeof b.cardRadius === 'string' && CARD_RADII.has(b.cardRadius) ? b.cardRadius : undefined;
  // Listing-card surface style + hover animation (plain/none = reset to default).
  const listingStyle = typeof b.listingStyle === 'string' && LISTING_STYLE_SET.has(b.listingStyle) ? b.listingStyle : undefined;
  const hoverAnim = typeof b.hoverAnim === 'string' && HOVER_ANIM_SET.has(b.hoverAnim) ? b.hoverAnim : undefined;
  const bannerUrl = b.bannerUrl === undefined ? undefined : safeUrl(b.bannerUrl);
  const faviconUrl = b.faviconUrl === undefined ? undefined : safeUrl(b.faviconUrl);
  const logoUrl = b.logoUrl === undefined ? undefined : safeUrl(b.logoUrl);
  const subheaderUrl = b.subheaderUrl === undefined ? undefined : safeUrl(b.subheaderUrl);

  // Store gallery: 1–5 uploaded https urls (photos of the shop itself).
  let galleryUrls: string[] | undefined;
  if (b.galleryUrls !== undefined) {
    const raw = Array.isArray(b.galleryUrls) ? b.galleryUrls : [];
    galleryUrls = [...new Set(
      raw.filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 500)
    )].slice(0, 5);
  }

  // Store-site features: announcement, delivery info, business hours, dropshipper.
  const announcement = b.announcement === undefined ? undefined : sanitizeText(b.announcement, 140) || null;
  // Announcement schedule: optional ISO timestamps; null clears the bound.
  const annStart = b.announcement_starts_at === undefined ? undefined : (typeof b.announcement_starts_at === 'string' && b.announcement_starts_at ? b.announcement_starts_at : null);
  const annEnd = b.announcement_ends_at === undefined ? undefined : (typeof b.announcement_ends_at === 'string' && b.announcement_ends_at ? b.announcement_ends_at : null);
  const deliveryInfo = b.deliveryInfo === undefined ? undefined : sanitizeText(b.deliveryInfo, 400) || null;
  const businessHours = b.businessHours === undefined ? undefined : safeHours(b.businessHours);
  const isDropshipper = typeof b.isDropshipper === 'boolean' ? b.isDropshipper : undefined;
  const dropshipInfo = b.dropshipInfo === undefined ? undefined : sanitizeText(b.dropshipInfo, 400) || null;

  // Category: validated against the canonical list (stores.category is free text
  // in the DB, but every surface — discover chips, rankings, map — expects a
  // known value; anything else renders as a raw slug).
  let category: string | undefined;
  if (b.category !== undefined) {
    if (!isStoreCategory(b.category)) {
      return apiError(422, 'invalid_category', 'Pick a category from the list.');
    }
    category = b.category;
  }

  // Social links: handles or full https URLs per network.
  const SOCIAL_KEYS = ['instagram', 'twitter', 'facebook', 'tiktok', 'youtube'] as const;
  let socialLinks: Record<string, string> | undefined;
  if (b.socialLinks !== undefined) {
    socialLinks = {};
    const raw = (b.socialLinks ?? {}) as Record<string, unknown>;
    for (const key of SOCIAL_KEYS) {
      const value = sanitizeText(raw[key], 120);
      if (value) socialLinks[key] = value.replace(/^@/, '');
    }
  }

  if (whatsappNumber && !isValidPhone(whatsappNumber)) {
    return apiError(422, 'invalid_phone', 'Enter the WhatsApp number in international format, e.g. +2348012345678.');
  }
  if ((latitude === null) !== (longitude === null)) {
    return apiError(422, 'incomplete_location', 'Set both latitude and longitude, or clear both.');
  }
  // Contrast guard: button text must be readable on the chosen accent.
  if (accentColor && accentText && !isValidHexColor(accentColor, accentText)) {
    return apiError(422, 'contrast', 'Pick a lighter or darker accent so button text stays readable.');
  }

  try {
    const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    const { error: storeErr } = await sb
      .from('stores')
      .update({
        address,
        latitude,
        longitude,
        whatsapp_number: whatsappNumber,
        ...(socialLinks !== undefined ? { social_links: socialLinks } : {}),
        ...(announcement !== undefined ? { announcement } : {}),
        ...(annStart !== undefined ? { announcement_starts_at: annStart } : {}),
        ...(annEnd !== undefined ? { announcement_ends_at: annEnd } : {}),
        ...(deliveryInfo !== undefined ? { delivery_info: deliveryInfo } : {}),
        ...(businessHours !== undefined ? { business_hours: businessHours } : {}),
        ...(isDropshipper !== undefined ? { is_dropshipper: isDropshipper } : {}),
        ...(dropshipInfo !== undefined ? { dropship_info: dropshipInfo } : {}),
        ...(category !== undefined ? { category } : {}),
      })
      .eq('id', store.id);
    if (storeErr) throw storeErr;

    const { error: waErr } = await sb.from('whatsapp_settings').upsert({
      store_id: store.id,
      business_number: whatsappNumber,
      greeting_message: greetingMessage,
      catalog_enabled: catalogEnabled,
    });
    if (waErr) throw waErr;

    // Appearance theme — only touch store_themes when any theme field was sent.
    const themePatch: Record<string, unknown> = {
      ...(accentColor !== undefined ? { accent_color: accentColor } : {}),
      ...(accentSoft !== undefined ? { accent_soft: accentSoft } : {}),
      ...(accentText !== undefined ? { accent_text: accentText } : {}),
      ...(backgroundColor !== undefined ? { background_color: backgroundColor } : {}),
      ...(fontHeading !== undefined ? { font_heading: fontHeading } : {}),
      ...(fontBody !== undefined ? { font_body: fontBody } : {}),
      ...(layout !== undefined ? { layout } : {}),
      ...(heroStyle !== undefined ? { hero_style: heroStyle } : {}),
      ...(textColor !== undefined ? { text_color: textColor } : {}),
      ...(headingColor !== undefined ? { heading_color: headingColor } : {}),
      ...(mutedColor !== undefined ? { muted_color: mutedColor } : {}),
      ...(buttonShape !== undefined ? { button_shape: buttonShape } : {}),
      ...(cardStyle !== undefined ? { card_style: cardStyle } : {}),
      ...(listingColor !== undefined ? { listing_color: listingColor } : {}),
      ...(listingBgColor !== undefined ? { listing_bg_color: listingBgColor } : {}),
      ...(cardRadius !== undefined ? { card_radius: cardRadius } : {}),
      ...(listingStyle !== undefined ? { listing_style: listingStyle } : {}),
      ...(hoverAnim !== undefined ? { hover_anim: hoverAnim } : {}),
      ...(bannerUrl !== undefined ? { banner_url: bannerUrl } : {}),
      ...(faviconUrl !== undefined ? { favicon_url: faviconUrl } : {}),
      ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
      ...(subheaderUrl !== undefined ? { subheader_url: subheaderUrl } : {}),
      ...(galleryUrls !== undefined ? { gallery_urls: galleryUrls } : {}),
    };
    if (Object.keys(themePatch).length > 0) {
      const { error: themeErr } = await sb.from('store_themes').upsert({
        store_id: store.id,
        ...themePatch,
      });
      if (themeErr) throw themeErr;
    }

    // Settings changed the public store site — evict its ISR cache now.
    revalidateStore(store.slug);

    return apiOk({ saved: true, ...(category !== undefined ? { category, categoryLabel: categoryLabel(category) } : {}) });
  } catch (err) {
    return internalError('settings', err);
  }
}
