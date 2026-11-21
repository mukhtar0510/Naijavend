// Hero copy the owner has locked (docs/KWARAVEND_REBRAND_CHANGES.md, R1).
// Change these strings only when the owner asks in plain words, and update the
// guard test (locked-copy.test.ts) in the same commit.

// LOCKED BY OWNER (changed to "storefront" on 21 Nov 2026)
export const HERO_HEADLINE = 'Your storefront deserves more than a WhatsApp catalogue.';
/** The one word shown in gold inside the headline. */
export const HERO_GOLD_WORD = 'more';

// LOCKED BY OWNER
export const HERO_SUB =
  'Create an online store, take orders and deliveries, and let customers near you in Ilorin find you.';
// LOCKED BY OWNER
export const HERO_PRIMARY_CTA = 'Open your store, free';
// LOCKED BY OWNER
export const HERO_SECONDARY_CTA = 'Explore stores near you';
// LOCKED BY OWNER
export const HERO_PILLS = ['No card to start', 'No commission', 'Pickup or delivery'] as const;
// LOCKED BY OWNER
export const NAV_SELL_BUTTON = 'Sell free';
// LOCKED BY OWNER
export const MOCKUP_LABEL = 'EXAMPLE STOREFRONT';

/**
 * The headline split into display lines with the gold word marked, without
 * changing a single word: joining every part with spaces gives HERO_HEADLINE.
 */
export function heroHeadlineLines(): Array<Array<{ text: string; gold?: boolean }>> {
  const words = HERO_HEADLINE.split(' ');
  const gold = words.indexOf(HERO_GOLD_WORD);
  // "Your storefront" / "deserves more than a" / "WhatsApp catalogue."
  const lines = [words.slice(0, 2), words.slice(2, 6), words.slice(6)];
  let i = 0;
  return lines.map((line) =>
    line.map((text) => {
      const part = { text, gold: i === gold || undefined };
      i += 1;
      return part;
    }),
  );
}
