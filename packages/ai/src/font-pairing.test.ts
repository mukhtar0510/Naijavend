import { describe, expect, it } from 'vitest';
import { aiComplete } from './index';

// The AI stylist should return curated font pairings for vibe keywords,
// matching heading + body fonts that the settings API accepts (STORE_FONTS).

const STORE_FONTS = [
  'Sora', 'Inter', 'DM Sans', 'Space Grotesk', 'Manrope', 'Outfit',
  'Plus Jakarta Sans', 'Urbanist', 'Playfair Display', 'Merriweather',
  'Lora', 'Libre Baskerville', 'Fraunces', 'Cormorant Garamond',
  'Bricolage Grotesque', 'Bebas Neue', 'Unbounded', 'Oswald',
  'Dancing Script', 'Pacifico', 'Great Vibes', 'Satisfy', 'Caveat',
];

async function style(brief: string) {
  const r = await aiComplete({ feature: 'style_store', input: brief });
  return r.draft as { font_heading: string; font_body: string; note: string; layout: string };
}

describe('AI stylist font pairing', () => {
  it('elegant boutique → Playfair Display + Lora', async () => {
    const s = await style('an elegant boutique for luxury fabrics');
    expect(s.font_heading).toBe('Playfair Display');
    expect(s.font_body).toBe('Lora');
    expect(s.note).toContain('elegant');
  });

  it('romantic florist → Great Vibes + Lora', async () => {
    const s = await style('a romantic wedding flower studio');
    expect(s.font_heading).toBe('Great Vibes');
    expect(s.font_body).toBe('Lora');
  });

  it('bold gym → Bebas Neue + Manrope', async () => {
    const s = await style('a strong fitness gym with powerful energy');
    expect(s.font_heading).toBe('Bebas Neue');
    expect(s.font_body).toBe('Manrope');
  });

  it('playful candy shop → Dancing Script + Plus Jakarta Sans', async () => {
    const s = await style('a playful kids party shop full of sweets');
    expect(s.font_heading).toBe('Dancing Script');
    expect(s.font_body).toBe('Plus Jakarta Sans');
  });

  it('futuristic gaming → Unbounded + Space Grotesk', async () => {
    const s = await style('a futuristic neon gaming store');
    expect(s.font_heading).toBe('Unbounded');
    expect(s.font_body).toBe('Space Grotesk');
  });

  it('minimal spa → Manrope + Urbanist', async () => {
    const s = await style('a calm minimal wellness spa');
    expect(s.font_heading).toBe('Manrope');
    expect(s.font_body).toBe('Urbanist');
  });

  it('every vibe brief returns fonts from the canonical STORE_FONTS list', async () => {
    for (const brief of [
      'elegant luxury boutique', 'romantic florals', 'handmade crafts',
      'creative art studio', 'retro surf shop', 'modern tech startup',
      'bold fitness gym', 'futuristic neon gaming', 'classic formal consulting',
      'editorial fashion magazine', 'playful kids toys', 'minimal calm spa',
    ]) {
      const s = await style(brief);
      expect(STORE_FONTS, `${brief} heading`).toContain(s.font_heading);
      expect(STORE_FONTS, `${brief} body`).toContain(s.font_body);
    }
  });

  it('pairing works on dark category presets too (software store)', async () => {
    // software category maps to a dark preset that normally skips font rules;
    // the vibe pairing should still apply.
    const s = await style('software store, elegant and premium');
    expect(s.font_heading).toBe('Playfair Display');
  });

  it('briefs with no vibe keyword keep the category preset fonts', async () => {
    const s = await style('a kitchen utensils shop');
    expect(STORE_FONTS).toContain(s.font_heading);
    expect(STORE_FONTS).toContain(s.font_body);
  });
});
