import { describe, expect, it } from 'vitest';
import {
  HERO_GOLD_WORD,
  HERO_HEADLINE,
  HERO_PILLS,
  HERO_PRIMARY_CTA,
  HERO_SECONDARY_CTA,
  HERO_SUB,
  MOCKUP_LABEL,
  NAV_SELL_BUTTON,
  heroHeadlineLines,
} from './locked-copy';

// Guard for the owner-locked hero copy (docs/KWARAVEND_REBRAND_CHANGES.md).
// If this fails, the copy was changed without the owner: put it back.
describe('locked hero copy', () => {
  it('keeps the owner headline, word for word', () => {
    expect(HERO_HEADLINE).toBe('Your storefront deserves more than a WhatsApp catalogue.');
    expect(HERO_HEADLINE).not.toMatch(/business deserves/i);
  });

  it('marks exactly the word "more" in gold', () => {
    expect(HERO_GOLD_WORD).toBe('more');
    const parts = heroHeadlineLines().flat();
    expect(parts.filter((p) => p.gold).map((p) => p.text)).toEqual(['more']);
  });

  it('splits into display lines without changing the words', () => {
    const lines = heroHeadlineLines();
    expect(lines).toHaveLength(3);
    expect(lines.flat().map((p) => p.text).join(' ')).toBe(HERO_HEADLINE);
  });

  it('keeps the rest of the locked hero', () => {
    expect(HERO_SUB).toBe('Create an online store, take orders and deliveries, and let customers near you in Ilorin find you.');
    expect(HERO_PRIMARY_CTA).toBe('Open your store, free');
    expect(HERO_SECONDARY_CTA).toBe('Explore stores near you');
    expect([...HERO_PILLS]).toEqual(['No card to start', 'No commission', 'Pickup or delivery']);
    expect(NAV_SELL_BUTTON).toBe('Sell free');
    expect(MOCKUP_LABEL).toBe('EXAMPLE STOREFRONT');
  });
});
