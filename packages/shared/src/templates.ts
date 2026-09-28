import type { StoreLayout, StoreTheme } from './types';

/** Structural store-site templates: same content, different skeleton (masthead → footer). */
export interface StoreTemplate {
  id: StoreLayout;
  name: string;
  tagline: string;
  bestFor: string;
}

export const STORE_TEMPLATES: StoreTemplate[] = [
  { id: 'modern',      name: 'Modern',      tagline: 'Clean centred hero, balanced grid',              bestFor: 'Most stores' },
  { id: 'classic',     name: 'Classic',     tagline: 'Traditional serif headings, roomy cards',        bestFor: 'Boutiques & tailors' },
  { id: 'bold',        name: 'Bold',        tagline: 'Loud type, hard shadows, poster energy',         bestFor: 'Streetwear & gadgets' },
  { id: 'minimal',     name: 'Minimal',     tagline: 'Quiet type, hairline borders, edge-aligned',     bestFor: 'Studios & consultants' },
  { id: 'boutique',    name: 'Boutique',    tagline: 'Editorial serif hero, centred masthead, magazine grid', bestFor: 'Beauty & fashion' },
  { id: 'merchant',    name: 'Merchant',    tagline: 'Dark masthead, quick-buy cards, busy storefront', bestFor: 'High-volume sellers' },
  { id: 'luxury',      name: 'Luxury',      tagline: 'Black-and-gold, wide letter-spacing, jewellery-box cards', bestFor: 'Jewellery & premium brands' },
  { id: 'playful',     name: 'Playful',     tagline: 'Chunky rounded corners, bouncy pill buttons, fun colours', bestFor: 'Kids, snacks & gifts' },
  { id: 'sunset',      name: 'Sunset',      tagline: 'Warm gradient hero, sunset-tinted cards',        bestFor: 'Food, décor & lifestyle' },
  { id: 'marketplace', name: 'Marketplace', tagline: 'Busy grid with accent header, like the Naijavend app', bestFor: 'Multi-product shops' },
  { id: 'editorial',   name: 'Editorial',   tagline: 'Magazine-style serif hero, two-column story grid', bestFor: 'Fashion & storytelling brands' },
  { id: 'neon',        name: 'Neon',        tagline: 'Glowing accents on a dark stage — nightlife energy', bestFor: 'Gaming, events & nightlife' },
  { id: 'pastel',      name: 'Pastel',      tagline: 'Soft candy tints, extra-rounded cards, gentle shadows', bestFor: 'Baby, bakery & gifting' },
  { id: 'monochrome',  name: 'Monochrome',  tagline: 'Greyscale everything — one accent colour pops',  bestFor: 'Photography & studios' },
  { id: 'showcase',    name: 'Showcase',    tagline: 'Full-bleed image hero, edge-to-edge gallery grid', bestFor: 'Photographers & artists' },
  { id: 'festival',    name: 'Festival',    tagline: 'Vibrant banners, confetti accents, celebration grid', bestFor: 'Event planners & caterers' },
  { id: 'artisan',     name: 'Artisan',     tagline: 'Handcrafted feel: warm paper texture, stitched borders, serif craft type', bestFor: 'Crafts, ceramics & candles' },
  { id: 'executive',   name: 'Executive',   tagline: 'Corporate navy and grey, structured tables, no-nonsense cards', bestFor: 'Consultants, law & B2B services' },
  { id: 'aurora',      name: 'Aurora',      tagline: 'Iridescent gradient washes with soft glass cards', bestFor: 'Beauty tech, nails & glam' },
  { id: 'corner',      name: 'Corner Shop', tagline: 'Neighbourhood-shop warmth: awning header, friendly rounded everything', bestFor: 'Groceries & provisions' },
];

export function isStoreTemplate(v: string): v is StoreTheme['layout'] {
  return STORE_TEMPLATES.some((t) => t.id === v);
}
