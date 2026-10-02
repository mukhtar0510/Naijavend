// Seller-selectable store theme options, in ONE canonical place so the
// settings API, dashboard picker, DB constraints and Google Fonts stylesheet
// stay in sync.

/** The 20 seller-selectable fonts (all on Google Fonts, loaded app-wide). */
export const STORE_FONTS = [
  // Modern sans — clean, app-like
  'Sora',
  'Inter',
  'DM Sans',
  'Space Grotesk',
  'Manrope',
  'Outfit',
  'Plus Jakarta Sans',
  'Urbanist',
  // Serious serif — premium, editorial
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Libre Baskerville',
  'Fraunces',
  'Cormorant Garamond',
  // Display / character — loud, memorable headings
  'Bricolage Grotesque',
  'Bebas Neue',
  'Unbounded',
  'Oswald',
  // Cursive / handwritten — personal, boutique energy (researched: top-rated
  // Google script fonts for branding: Dancing Script, Pacifico, Great Vibes,
  // Satisfy, Caveat)
  'Dancing Script',
  'Pacifico',
  'Great Vibes',
  'Satisfy',
  'Caveat',
] as const;

export type StoreFont = (typeof STORE_FONTS)[number];

export function isStoreFont(v: string): v is StoreFont {
  return (STORE_FONTS as readonly string[]).includes(v);
}

/** Fonts whose cursive glyphs run small — bump their heading size slightly. */
export const CURSIVE_FONTS: readonly string[] = ['Dancing Script', 'Great Vibes', 'Satisfy', 'Caveat', 'Pacifico'];

/** The 16 structural store-site templates. */
export const STORE_LAYOUTS = [
  'modern',
  'classic',
  'bold',
  'minimal',
  'boutique',
  'merchant',
  'luxury',
  'playful',
  'sunset',
  'marketplace',
  'editorial',
  'neon',
  'pastel',
  'monochrome',
  'showcase',
  'festival',
  'artisan',
  'executive',
  'aurora',
  'corner',
] as const;

export type StoreLayoutOption = (typeof STORE_LAYOUTS)[number];

export function isStoreLayout(v: string): v is StoreLayoutOption {
  return (STORE_LAYOUTS as readonly string[]).includes(v);
}

/** Listing-card surface treatments (data-listing-style on .site-shell). */
export const LISTING_STYLES = ['plain', 'gradient', 'glass', 'outlined', 'elevated'] as const;
export type ListingStyle = (typeof LISTING_STYLES)[number];

/** Listing-card hover animations (data-hover-anim on .site-shell). */
export const HOVER_ANIMS = ['none', 'lift', 'tilt', 'zoom', 'glow', 'wiggle'] as const;
export type HoverAnim = (typeof HOVER_ANIMS)[number];

/**
 * Site-wide background gradient presets (researched: the Shopify/Fourthwall
 * style — curated, on-brand gradients instead of freeform CSS, which would be
 * an XSS/contrast hazard). Key is stored in store_themes.background_gradient;
 * the CSS value is looked up at render time. Light presets pair with dark ink,
 * dark presets (charcoal, plum) should be used with light text colours.
 */
export const BACKGROUND_GRADIENTS = {
  sunset: 'linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 45%, #FED7AA 100%)',
  ocean: 'linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 55%, #BFDBFE 100%)',
  mint: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 55%, #BBF7D0 100%)',
  lavender: 'linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 55%, #E9D5FF 100%)',
  rosewater: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 55%, #FECDD3 100%)',
  gold: 'linear-gradient(180deg, #FEFCE8 0%, #FDF6B2 55%, #FDE68A 100%)',
  charcoal: 'linear-gradient(180deg, #18181B 0%, #27272A 60%, #3F3F46 100%)',
  plum: 'linear-gradient(160deg, #2E1065 0%, #4C1D95 55%, #6D28D9 100%)',
} as const satisfies Record<string, string>;

export type BackgroundGradientKey = keyof typeof BACKGROUND_GRADIENTS;

export function isBackgroundGradient(v: string): v is BackgroundGradientKey {
  return Object.prototype.hasOwnProperty.call(BACKGROUND_GRADIENTS, v);
}

/** How a seller-uploaded background photo fills the page: fill the viewport or tile as a pattern. */
export const BACKGROUND_IMAGE_STYLES = ['cover', 'tile'] as const;
export type BackgroundImageStyle = (typeof BACKGROUND_IMAGE_STYLES)[number];

/** Darkening layer over a background photo so text stays readable on busy images. */
export const BACKGROUND_OVERLAYS = ['none', 'dim', 'dark'] as const;
export type BackgroundOverlay = (typeof BACKGROUND_OVERLAYS)[number];

/** Width of the page container on the store site (defaults to 'normal'). */
export const CONTENT_WIDTHS = ['narrow', 'normal', 'wide'] as const;
export type ContentWidth = (typeof CONTENT_WIDTHS)[number];
