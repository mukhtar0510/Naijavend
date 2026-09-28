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
