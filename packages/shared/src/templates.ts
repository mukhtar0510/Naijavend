import type { StoreLayout, StoreTheme } from './types';

/** Structural store-site templates: same content, different skeleton (masthead → footer). */
export interface StoreTemplate {
  id: StoreLayout;
  name: string;
  tagline: string;
  bestFor: string;
  /**
   * Starter templates ship with every plan, including the free tier (7 of them).
   * Premium templates unlock on Business and above. Plus templates are only for
   * Emirates Plus. Anyone can preview every template; saving is plan-checked.
   * Order matters: starter, then premium, then plus, because plans allow the
   * first N templates (see apps/storefront/src/lib/plans.ts).
   */
  tier?: 'starter' | 'premium' | 'plus';
}

export const STORE_TEMPLATES: StoreTemplate[] = [
  { id: 'modern',      name: 'Modern',      tagline: 'Clean centred hero, balanced grid',              bestFor: 'Most stores', tier: 'starter' },
  { id: 'classic',     name: 'Classic',     tagline: 'Traditional serif headings, roomy cards',        bestFor: 'Boutiques & tailors', tier: 'starter' },
  { id: 'bold',        name: 'Bold',        tagline: 'Loud type, hard shadows, poster energy',         bestFor: 'Streetwear & gadgets', tier: 'starter' },
  { id: 'minimal',     name: 'Minimal',     tagline: 'Quiet type, hairline borders, edge-aligned',     bestFor: 'Studios & consultants', tier: 'starter' },
  { id: 'boutique',    name: 'Boutique',    tagline: 'Editorial serif hero, centred masthead, magazine grid', bestFor: 'Beauty & fashion', tier: 'starter' },
  { id: 'merchant',    name: 'Merchant',    tagline: 'Dark masthead, quick-buy cards, busy storefront', bestFor: 'High-volume sellers', tier: 'starter' },
  { id: 'luxury',      name: 'Luxury',      tagline: 'Black-and-gold, wide letter-spacing, jewellery-box cards', bestFor: 'Jewellery & premium brands', tier: 'starter' },
  { id: 'playful',     name: 'Playful',     tagline: 'Chunky rounded corners, bouncy pill buttons, fun colours', bestFor: 'Kids, snacks & gifts', tier: 'premium' },
  { id: 'sunset',      name: 'Sunset',      tagline: 'Warm gradient hero, sunset-tinted cards',        bestFor: 'Food, décor & lifestyle', tier: 'premium' },
  { id: 'marketplace', name: 'Marketplace', tagline: 'Busy grid with accent header, like the Kwaravend app', bestFor: 'Multi-product shops', tier: 'premium' },
  { id: 'editorial',   name: 'Editorial',   tagline: 'Magazine-style serif hero, two-column story grid', bestFor: 'Fashion & storytelling brands', tier: 'premium' },
  { id: 'neon',        name: 'Neon',        tagline: 'Glowing accents on a dark stage — nightlife energy', bestFor: 'Gaming, events & nightlife', tier: 'premium' },
  { id: 'pastel',      name: 'Pastel',      tagline: 'Soft candy tints, extra-rounded cards, gentle shadows', bestFor: 'Baby, bakery & gifting', tier: 'premium' },
  { id: 'monochrome',  name: 'Monochrome',  tagline: 'Greyscale everything — one accent colour pops',  bestFor: 'Photography & studios', tier: 'premium' },
  { id: 'showcase',    name: 'Showcase',    tagline: 'Full-bleed image hero, edge-to-edge gallery grid', bestFor: 'Photographers & artists', tier: 'premium' },
  { id: 'festival',    name: 'Festival',    tagline: 'Vibrant banners, confetti accents, celebration grid', bestFor: 'Event planners & caterers', tier: 'premium' },
  { id: 'artisan',     name: 'Artisan',     tagline: 'Handcrafted feel: warm paper texture, stitched borders, serif craft type', bestFor: 'Crafts, ceramics & candles', tier: 'premium' },
  { id: 'executive',   name: 'Executive',   tagline: 'Corporate navy and grey, structured tables, no-nonsense cards', bestFor: 'Consultants, law & B2B services', tier: 'premium' },
  { id: 'aurora',      name: 'Aurora',      tagline: 'Iridescent gradient washes with soft glass cards', bestFor: 'Beauty tech, nails & glam', tier: 'premium' },
  { id: 'corner',      name: 'Corner Shop', tagline: 'Neighbourhood-shop warmth: awning header, friendly rounded everything', bestFor: 'Groceries & provisions', tier: 'premium' },
  // Emirates Plus only.
  { id: 'royale',      name: 'Royale',      tagline: 'Deep emerald and gold, crest masthead, framed gallery cards', bestFor: 'Flagship and premium brands', tier: 'plus' },
  { id: 'skyline',     name: 'Skyline',     tagline: 'Night-sky hero with oversized type, floating glass masthead and lifted cards', bestFor: 'Electronics, autos and big catalogues', tier: 'plus' },
  { id: 'atelier',     name: 'Atelier',     tagline: 'Split editorial hero, tall image cards, captions under fine rules', bestFor: 'Fashion houses, studios and interiors', tier: 'plus' },
];

/**
 * The seven templates that ship with the free/Starter tier. The gallery on the
 * marketing pages shows these first and marks the rest as plan upgrades.
 */
export const STARTER_TEMPLATE_COUNT = 7;

export const STARTER_TEMPLATES: StoreTemplate[] = STORE_TEMPLATES.filter((t) => t.tier === 'starter');

export const PREMIUM_TEMPLATES: StoreTemplate[] = STORE_TEMPLATES.filter((t) => t.tier === 'premium');

/** Templates only Emirates Plus may publish. */
export const PLUS_TEMPLATES: StoreTemplate[] = STORE_TEMPLATES.filter((t) => t.tier === 'plus');

/** Starter + premium: what Business may publish (everything before the Plus-only ones). */
export const BUSINESS_TEMPLATE_COUNT = STORE_TEMPLATES.length - PLUS_TEMPLATES.length;

/** Which templates a plan may publish. `null` means every template. */
export function templatesForPlan(templateLimit: number | null): StoreTemplate[] {
  if (templateLimit == null) return STORE_TEMPLATES;
  return STORE_TEMPLATES.slice(0, Math.max(0, templateLimit));
}

export function isStoreTemplate(v: string): v is StoreTheme['layout'] {
  return STORE_TEMPLATES.some((t) => t.id === v);
}
