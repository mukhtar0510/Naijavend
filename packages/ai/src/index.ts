// aiComplete — suite-wide AI wrapper interface (blueprint §1/§5).
// Current provider: "dummy" (deterministic template generator, no API key needed).
// To wire a real provider later: implement AiProvider and change getProvider().
// Every call is meant to be logged to ai_usage_log by the caller (server route).

import type { AiFeature, AiStoreDraft, AiListingDraft, AiStyleDraft } from '@idevtenancy/shared';

export interface AiRequest {
  feature: AiFeature;
  input: string;
}

export interface AiResponse {
  draft: AiStoreDraft | AiListingDraft | AiStyleDraft;
  tokensUsed: number;
  provider: string;
}

export interface AiProvider {
  readonly name: string;
  complete(req: AiRequest): Promise<AiResponse>;
}

// ---------------------------------------------------------------------------
// Dummy provider — deterministic template generator. Good enough for the full
// onboarding flow; sellers edit the draft before publishing regardless.
// ---------------------------------------------------------------------------

const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['salon', 'braid', 'hair', 'barb', 'nail', 'spa', 'makeup', 'gele'], category: 'beauty' },
  { keywords: ['tailor', 'fashion', 'sew', 'cloth', 'clothing', 'aso ebi', 'ankara', 'boutique', 'clothes', 'wear', 'apparel'], category: 'fashion' },
  { keywords: ['kitchen', 'cookware', 'pot', 'utensil', 'blender', 'appliance'], category: 'kitchen' },
  { keywords: ['food', 'restaurant', 'cater', 'chop', 'grill', 'snacks', 'small chops', 'cake'], category: 'food' },
  { keywords: ['groceries', 'grocery', 'provisions', 'supermarket', 'foodstuff', 'market run'], category: 'groceries' },
  { keywords: ['craft', 'crochet', 'knit', 'beads', 'handmade', 'handmade', 'art', 'candle', 'soap'], category: 'crafts' },
  { keywords: ['gym', 'fitness', 'trainer', 'yoga', 'workout', 'weight loss'], category: 'fitness' },
  { keywords: ['tutor', 'lesson', 'teach', 'school', 'training', 'lesson'], category: 'education' },
  { keywords: ['repair', 'technician', 'electrician', 'plumber', 'ac ', 'generator'], category: 'home-services' },
  { keywords: ['dropship', 'dropshipping', 'supplier', 'aliexpress', '1688', 'import', 'resell'], category: 'dropshippers' },
  { keywords: ['phone', 'laptop', 'gadget', 'electronics'], category: 'electronics' },
  // Tech & digital
  { keywords: ['software', 'app development', 'web design', 'web development', 'saas', 'programmer', 'developer', 'tech company', 'ui ux', 'website design'], category: 'software' },
  { keywords: ['ebook', 'template', 'digital product', 'online course', 'presets', 'downloadable', 'digital download', 'canva template'], category: 'digital-products' },
  { keywords: ['game', 'gaming', 'playstation', 'xbox', 'console', 'esports', 'pc gamer'], category: 'gaming' },
  { keywords: ['social media manager', 'marketing', 'advertising', 'seo ', 'branding agency', 'promo', 'influencer'], category: 'marketing' },
  // People & lifestyle
  { keywords: ['wellness', 'therapy', 'massage', 'supplement', 'skincare products', 'holistic', 'spa products', 'herbal'], category: 'health-wellness' },
 { keywords: ['baby', 'kids', 'children', 'toys', 'childcare', 'nursery', 'toddler'], category: 'baby-kids' },
  { keywords: ['pet', 'dog', 'cat food', 'veterinary', 'animal feed', 'grooming'], category: 'pets' },
  { keywords: ['jewelry', 'jewellery', 'watch', 'necklace', 'ring', 'earring', 'goldsmith', 'beaded jewelry'], category: 'jewelry' },
  // Creative & events
  { keywords: ['photographer', 'photography', 'videographer', 'photo studio', 'camera', 'videography'], category: 'photography' },
  { keywords: ['dj ', 'disc jockey', 'instrument', 'guitar', 'piano', 'music production', 'choir', 'sound system'], category: 'music' },
  { keywords: ['artist', 'painting', 'portrait', 'commission', 'wall art', 'sketch', 'canvas art'], category: 'art' },
  { keywords: ['event planner', 'party', 'decor', 'rental chairs', 'canopy', 'mc ', 'master of ceremony', 'usheer', 'event centre'], category: 'events' },
  // Trade & industry
  { keywords: ['car', 'mechanic', 'auto', 'spare part', 'tyre', 'tire', 'detailing', 'vehicle'], category: 'auto' },
  { keywords: ['farm', 'farm produce', 'poultry', 'fish farming', 'seedling', 'livestock', 'agric', 'palm oil', 'yam', 'garri'], category: 'agriculture' },
  { keywords: ['real estate', 'property', 'land ', 'apartment for', 'shortlet', 'agent', 'rent house', 'housing'], category: 'real-estate' },
  { keywords: ['lawyer', 'legal', 'accountant', 'consulting', 'consultant', 'bookkeeping', 'business registration', 'cac registration'], category: 'professional-services' },
  { keywords: ['courier', 'dispatch', 'delivery service', 'logistics', 'haulage', 'waybill', 'shipping'], category: 'logistics' },
  { keywords: ['printing', 'print', 'banner', 'flex ', 'stationery', 'mug printing', 'custom shirt', 'branded gift'], category: 'printing' },
  { keywords: ['furniture', 'interior decor', 'sofa', 'bed frame', 'wardrobe', 'carpenter', 'upholstery'], category: 'furniture' },
  { keywords: ['laundry', 'dry cleaning', 'cleaning service', 'wash and fold', 'housekeeping', 'fumigation'], category: 'laundry' },
];

function inferCategory(input: string): string {
  const lower = input.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.category;
  }
  return 'general';
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// style_store — palette/style presets keyed by business category. The AI maps
// a natural-language brief onto a complete, contrast-checked theme draft.
// ---------------------------------------------------------------------------

interface StylePreset {
  accent_color: string;
  accent_soft: string;
  accent_text: string;
  font_heading: string;
  font_body: string;
  layout: AiStyleDraft['layout'];
  hero_style: AiStyleDraft['hero_style'];
  background_color: string;
  text_color?: string;
  heading_color?: string;
  muted_color?: string;
  note: string;
}

// Relative-luminance based black/white text pick so accents stay readable.
function readableTextOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#0B0C0E' : '#FFFFFF';
}

const CATEGORY_PRESETS: Record<string, StylePreset> = {
  beauty: {
    accent_color: '#BE1E6B',
    accent_soft: '#E46AA0',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'gradient',
    background_color: '#FFFBF8',
    note: 'Warm rose accent with an editorial serif — reads polished and personal, perfect for beauty brands.',
  },
  fashion: {
    accent_color: '#0B0C0E',
    accent_soft: '#3D4048',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'image',
    background_color: '#FFFFFF',
    note: 'Black-on-white couture palette with big serif headlines — lets photography carry the store.',
  },
  food: {
    accent_color: '#B4430C',
    accent_soft: '#E8763B',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'merchant',
    hero_style: 'image',
    background_color: '#FFFDF9',
    note: 'Appetising terracotta accent on a warm cream base — hero imagery sells the food.',
  },
  electronics: {
    accent_color: '#1D4ED8',
    accent_soft: '#3B82F6',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'merchant',
    hero_style: 'gradient',
    background_color: '#FFFFFF',
    note: 'Tech-blue palette with clean geometric headlines — signals precision and trust.',
  },
  education: {
    accent_color: '#166534',
    accent_soft: '#2F9E5B',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'minimal',
    hero_style: 'gradient',
    background_color: '#FBFDFB',
    note: 'Grounded green on an off-white page — calm, credible, study-friendly.',
  },
  'home-services': {
    accent_color: '#0E7490',
    accent_soft: '#22A0BC',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'gradient',
    background_color: '#FFFFFF',
    note: 'Workmanlike teal — strong contrast for buttons and clear calls to action.',
  },
  // ---- Tech & digital ----
  software: {
    accent_color: '#6366F1',
    accent_soft: '#818CF8',
    accent_text: '#FFFFFF',
    font_heading: 'JetBrains Mono',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'gradient',
    background_color: '#0B1120',
    text_color: '#E2E8F0',
    heading_color: '#F8FAFC',
    muted_color: '#94A3B8',
    note: 'Indigo on a deep slate-dark page with mono headlines — reads like a modern dev tool.',
  },
  'digital-products': {
    accent_color: '#8B5CF6',
    accent_soft: '#A78BFA',
    accent_text: '#FFFFFF',
    font_heading: 'Space Grotesk',
    font_body: 'Inter',
    layout: 'minimal',
    hero_style: 'gradient',
    background_color: '#FAF8FF',
    note: 'Soft violet on an airy lavender-white base — clean creator-economy feel for digital goods.',
  },
  gaming: {
    accent_color: '#A855F7',
    accent_soft: '#C084FC',
    accent_text: '#FFFFFF',
    font_heading: 'Space Grotesk',
    font_body: 'Inter',
    layout: 'bold',
    hero_style: 'gradient',
    background_color: '#0F0A1E',
    text_color: '#EDE9FE',
    heading_color: '#F5F3FF',
    muted_color: '#A78BFA',
    note: 'Neon purple on near-black — RGB, esports energy without going full cyberpunk.',
  },
  marketing: {
    accent_color: '#EA580C',
    accent_soft: '#FB923C',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'bold',
    hero_style: 'gradient',
    background_color: '#FFFFFF',
    note: 'Conversion orange on crisp white with bold headlines — confident agency energy.',
  },
  // ---- People & lifestyle ----
  'health-wellness': {
    accent_color: '#0D9488',
    accent_soft: '#2DD4BF',
    accent_text: '#FFFFFF',
    font_heading: 'DM Sans',
    font_body: 'Inter',
    layout: 'minimal',
    hero_style: 'gradient',
    background_color: '#F4FBF9',
    note: 'Calm teal on a spa-fresh off-white — soft, trustworthy, wellness-first.',
  },
  'baby-kids': {
    accent_color: '#EC4899',
    accent_soft: '#F472B6',
    accent_text: '#FFFFFF',
    font_heading: 'DM Sans',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'gradient',
    background_color: '#FFF7FB',
    note: 'Warm pink on a blush-cream base with rounded type — playful but still premium for parents.',
  },
  pets: {
    accent_color: '#B45309',
    accent_soft: '#D97706',
    accent_text: '#FFFFFF',
    font_heading: 'DM Sans',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'image',
    background_color: '#FFFCF5',
    note: 'Warm amber on a creamy base with an image hero — lets pet photos do the selling.',
  },
  jewelry: {
    accent_color: '#B8860B',
    accent_soft: '#DAA520',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'solid',
    background_color: '#FFFEF8',
    note: 'Antique gold on ivory with an editorial serif — luxury showcase for fine pieces.',
  },
  // ---- Creative & events ----
  photography: {
    accent_color: '#0F172A',
    accent_soft: '#334155',
    accent_text: '#FFFFFF',
    font_heading: 'Space Grotesk',
    font_body: 'Inter',
    layout: 'minimal',
    hero_style: 'image',
    background_color: '#FFFFFF',
    note: 'Near-black on pure white, minimal layout — the gallery look that puts photos first.',
  },
  music: {
    accent_color: '#4F46E5',
    accent_soft: '#818CF8',
    accent_text: '#FFFFFF',
    font_heading: 'Space Grotesk',
    font_body: 'Inter',
    layout: 'bold',
    hero_style: 'gradient',
    background_color: '#0C0F2E',
    text_color: '#E0E7FF',
    heading_color: '#EEF2FF',
    muted_color: '#A5B4FC',
    note: 'Electric indigo on a stage-dark navy — concert-lighting vibe for DJs and producers.',
  },
  art: {
    accent_color: '#DB2777',
    accent_soft: '#EC4899',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'solid',
    background_color: '#FFFBFA',
    note: 'Gallery magenta on warm white with a display serif — frames artwork like a wall label.',
  },
  events: {
    accent_color: '#D97706',
    accent_soft: '#F59E0B',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'image',
    background_color: '#FFFBF2',
    note: 'Celebration amber on a warm ivory base with an image hero — party energy, still classy.',
  },
  // ---- Trade & industry ----
  auto: {
    accent_color: '#DC2626',
    accent_soft: '#EF4444',
    accent_text: '#FFFFFF',
    font_heading: 'Space Grotesk',
    font_body: 'Inter',
    layout: 'bold',
    hero_style: 'gradient',
    background_color: '#0C0C0E',
    text_color: '#F1F5F9',
    heading_color: '#FFFFFF',
    muted_color: '#94A3B8',
    note: 'Racing red on gloss black — garage-floor confidence for parts and detailing.',
  },
  agriculture: {
    accent_color: '#3F6212',
    accent_soft: '#65A30D',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'image',
    background_color: '#FBFDF4',
    note: 'Deep earthy green on a field-fresh cream — honest farm-to-table tones with an image hero.',
  },
  'real-estate': {
    accent_color: '#0F766E',
    accent_soft: '#14B8A6',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'classic',
    hero_style: 'image',
    background_color: '#FFFFFF',
    note: 'Trustworthy teal with an editorial serif — the established-agency look for property listings.',
  },
  'professional-services': {
    accent_color: '#1E40AF',
    accent_soft: '#3B82F6',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'classic',
    hero_style: 'solid',
    background_color: '#F8FAFC',
    note: 'Deep corporate blue on cool grey — signals credibility for legal, accounting, consulting.',
  },
  logistics: {
    accent_color: '#B45309',
    accent_soft: '#D97706',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'gradient',
    background_color: '#FFFFFF',
    note: 'Hi-vis amber on clean white — delivery-speed energy with strong CTA contrast.',
  },
  printing: {
    accent_color: '#6D28D9',
    accent_soft: '#8B5CF6',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'merchant',
    hero_style: 'gradient',
    background_color: '#FDFCFF',
    note: 'Ink violet on paper white — a print-shop palette that reads precise and colourful.',
  },
  furniture: {
    accent_color: '#92400E',
    accent_soft: '#B45309',
    accent_text: '#FFFFFF',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    layout: 'boutique',
    hero_style: 'image',
    background_color: '#FAF6F1',
    note: 'Walnut brown on warm linen — tactile, homey tones with an image hero for interiors.',
  },
  laundry: {
    accent_color: '#0284C7',
    accent_soft: '#38BDF8',
    accent_text: '#FFFFFF',
    font_heading: 'DM Sans',
    font_body: 'Inter',
    layout: 'minimal',
    hero_style: 'gradient',
    background_color: '#F5FAFE',
    note: 'Fresh-sky blue on a clean white — crisp, tidy, exactly what you want from laundry.',
  },
  general: {
    accent_color: '#1D4ED8',
    accent_soft: '#3B82F6',
    accent_text: '#FFFFFF',
    font_heading: 'Sora',
    font_body: 'Inter',
    layout: 'modern',
    hero_style: 'gradient',
    background_color: '#FFFFFF',
    note: 'The Naijavend default: white surfaces, blue actions, black accents — safe and modern.',
  },
};

/** Relative-luminance check: true when a hex background is dark enough that
 * light text is required (guards the brief-refiner against dark presets). */
function isDarkHex(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.3;
}

/**
 * Curated font pairings — each vibe maps a display-worthy heading font to a
 * highly-readable body font. All names must exist in STORE_FONTS (the canonical
 * list in @idevtenancy/shared) so the settings API accepts them.
 * Pairs follow the classic rule: characterful heading + quiet body.
 */
const FONT_PAIRINGS: Array<{ keywords: RegExp; heading: string; body: string; vibe: string }> = [
  // Stems deliberately have no trailing \b so 'elegan' matches 'elegant'.
  { keywords: /\b(elegan|luxur|premium|sophisticat|gold|jeweller|jeweler|bridal)/, heading: 'Playfair Display', body: 'Lora', vibe: 'elegant' },
  { keywords: /\b(romantic|wedding|delicate|feminine|flower|floral|soft)/, heading: 'Great Vibes', body: 'Lora', vibe: 'romantic' },
  { keywords: /\b(handmade|artisan|craft|personal|warm|friendly|home|bakery)/, heading: 'Caveat', body: 'DM Sans', vibe: 'handmade' },
  { keywords: /\b(creative|artist|paint|design|studio|agency|music)/, heading: 'Fraunces', body: 'Outfit', vibe: 'creative' },
  { keywords: /\b(retro|vintage|surf|skate|casual|chill|beach)/, heading: 'Pacifico', body: 'Inter', vibe: 'retro' },
  { keywords: /\b(modern|sleek|tech|startup|digital|software)/, heading: 'Space Grotesk', body: 'Inter', vibe: 'modern' },
  { keywords: /\b(bold|strong|impact|power|gym|fitness|sport|street)/, heading: 'Bebas Neue', body: 'Manrope', vibe: 'bold' },
  { keywords: /\b(futur|neon|gaming|crypto|cyber|nightlife|club)/, heading: 'Unbounded', body: 'Space Grotesk', vibe: 'futuristic' },
  { keywords: /\b(classic|timeless|tradition|formal|consult|finance)/, heading: 'Libre Baskerville', body: 'Merriweather', vibe: 'classic' },
  { keywords: /\b(editorial|magazine|fashion|couture|storytelling)/, heading: 'Cormorant Garamond', body: 'Lora', vibe: 'editorial' },
  { keywords: /\b(playful|fun|kids|children|toy|party|candy|sweet)/, heading: 'Dancing Script', body: 'Plus Jakarta Sans', vibe: 'playful' },
  { keywords: /\b(minimal|simple|quiet|zen|calm|wellness|spa|yoga)/, heading: 'Manrope', body: 'Urbanist', vibe: 'minimal' },
];

/** Pick the first pairing whose keywords appear in the brief. */
function pickFontPairing(lower: string): { heading: string; body: string; vibe: string } | null {
  for (const p of FONT_PAIRINGS) {
    if (p.keywords.test(lower)) {
      return { heading: p.heading, body: p.body, vibe: p.vibe };
    }
  }
  return null;
}

// Brief keywords can override the category preset (e.g. "dark", "luxury", "playful").
function refineBrief(lower: string, preset: StylePreset): StylePreset {
  const next = { ...preset };
  const pairing = pickFontPairing(lower);
  const applyPairing = () => {
    if (!pairing) return;
    next.font_heading = pairing.heading;
    next.font_body = pairing.body;
  };
  const isDarkPreset = isDarkHex(next.background_color);
  if (isDarkPreset) {
    // Dark category presets keep their backgrounds; a "dark/luxury/playful"
    // brief keyword must not swap in a near-black accent (invisible buttons).
    // Only the accent tone may shift — via the luxury rule below.
    if (/\b(luxur|premium|gold)\b/.test(lower)) {
      next.accent_color = '#C9A227';
      next.accent_soft = '#E3C766';
      next.accent_text = '#0B1120';
      next.note += ' Gold accents for a premium feel.';
    }
    // Vibe words still deserve their typography, even on a dark preset.
    applyPairing();
    if (pairing) next.note += ` ${pairing.heading} + ${pairing.body} type pairing for a ${pairing.vibe} feel.`;
    next.accent_text = readableTextOn(next.accent_color);
    return next;
  }
  if (/\b(dark|black|night|moody)\b/.test(lower)) {
    next.accent_color = '#0B0C0E';
    next.accent_soft = '#3D4048';
    next.accent_text = '#FFFFFF';
    next.background_color = '#FFFFFF';
    next.layout = 'bold';
    next.note = 'Dark bold accents on a white page — high-contrast and dramatic.';
  }
  if (/\b(luxur|premium|elegan|gold)\b/.test(lower)) {
    next.accent_color = '#8A6A1F';
    next.accent_soft = '#C9A227';
    next.accent_text = '#FFFFFF';
    next.font_heading = 'Playfair Display';
    next.layout = 'luxury';
    next.note = 'Gold accents, wide letter-spacing and jewellery-box cards for a premium feel.';
  }
  if (/\b(playful|fun|friendly|bright|youthful)\b/.test(lower)) {
    next.accent_color = '#7C3AED';
    next.accent_soft = '#A78BFA';
    next.accent_text = '#FFFFFF';
    next.font_heading = 'Sora';
    next.layout = 'playful';
    next.note = 'Violet accents with chunky rounded cards — energetic and friendly.';
  }
  if (/\b(natural|organic|green|eco)\b/.test(lower)) {
    next.accent_color = '#166534';
    next.accent_soft = '#2F9E5B';
    next.accent_text = '#FFFFFF';
    next.background_color = '#FBFDFB';
    next.note = 'Natural green palette on a soft off-white base.';
  }
  if (/\b(minimal|clean|simple)\b/.test(lower)) {
    next.layout = 'classic';
    next.hero_style = 'gradient';
    next.note = 'Minimal layout: quiet gradients, generous whitespace, one accent colour.';
  }
  // Font pairing runs LAST so a vibe match always wins over the category
  // preset's default fonts — but layout/accent rules above stay untouched.
  applyPairing();
  if (pairing) next.note += ` ${pairing.heading} headings with ${pairing.body} body text for a ${pairing.vibe} voice.`;
  next.accent_text = readableTextOn(next.accent_color);
  return next;
}

class DummyProvider implements AiProvider {
  readonly name = 'dummy';

  async complete(req: AiRequest): Promise<AiResponse> {
    const input = req.input.trim().slice(0, 600);
    const words = input.split(/\s+/).filter(Boolean);
    const category = inferCategory(input);

    // Rough deterministic token count so ai_usage_log has meaningful data.
    const tokensUsed = Math.max(12, Math.ceil((input.length + 120) / 4));

    if (req.feature === 'store_setup') {
      const nameWords = words.slice(0, 3).map((w) => w.replace(/[^a-zA-Z]/g, ''));
      const base = nameWords.filter(Boolean).slice(0, 2).map(titleCase).join(' ');
      const name = base ? `${base} Hub` : 'My New Store';

      const draft: AiStoreDraft = {
        name,
        description:
          `${name} is a ${category === 'general' ? 'trusted local' : category} business serving customers ` +
          `across Nigeria. ${input.charAt(0).toUpperCase()}${input.slice(1)} — quality service, fair prices, ` +
          `and fast response on WhatsApp. Browse what we offer below and reach out to book or order.`,
        category,
      };
      return { draft, tokensUsed, provider: this.name };
    }

    if (req.feature === 'style_store') {
      const base = CATEGORY_PRESETS[category] ?? CATEGORY_PRESETS.general;
      const draft: AiStyleDraft = refineBrief(input.toLowerCase(), base);
      return { draft, tokensUsed, provider: this.name };
    }

    // listing_description
    const draft: AiListingDraft = {
      description:
        `${input.charAt(0).toUpperCase()}${input.slice(1)}. Delivered with care and attention to detail. ` +
        `Message us on WhatsApp to confirm availability, custom requests, and delivery or booking options.`,
    };
    return { draft, tokensUsed, provider: this.name };
  }
}

let provider: AiProvider | null = null;

/** Returns the configured provider. Swap point for a real LLM provider later. */
export function getProvider(): AiProvider {
  if (!provider) provider = new DummyProvider();
  return provider;
}

// Minimal timer typing — this package targets a pure ES2022 lib (no DOM/Node types).
declare function setTimeout(handler: () => void, timeout: number): unknown;

/** aiComplete — the one entry point the rest of the suite calls. */
export async function aiComplete(req: AiRequest): Promise<AiResponse> {
  // Explicit timeout (backend skill #33) — dummy is instant, but the contract holds
  // when a real provider lands.
  const result = await Promise.race([
    getProvider().complete(req),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('aiComplete timeout after 15s')), 15_000)
    ),
  ]);
  return result;
}
