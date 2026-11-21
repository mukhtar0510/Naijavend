// Shared Motion presets (REDESIGN_V2 §0.1, §10). Pages use these, never
// ad-hoc numbers. Durations and easings mirror the CSS tokens in
// styles/tokens.css (--dur-1..4, --ease-*). Animate transform and opacity only.

import type { Transition, Variants } from 'motion/react';

/** Seconds, matching --dur-1..4 (120 / 200 / 320 / 500 ms). */
export const DUR = { fast: 0.12, base: 0.2, slow: 0.32, slower: 0.5 } as const;

/** Cubic-bezier easings matching --ease-standard / --ease-emphasised. */
export const EASE = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  emphasised: [0.3, 0, 0, 1.2] as [number, number, number, number],
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

export const SPRING = {
  /** Selection, chips, tab underline. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } satisfies Transition,
  /** Cards, mockups sliding in. */
  soft: { type: 'spring', stiffness: 220, damping: 26 } satisfies Transition,
  /** Sheets and drawers (momentum feel). */
  sheet: { type: 'spring', stiffness: 380, damping: 38 } satisfies Transition,
  /** Pointer-follow tilt. */
  tilt: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 } satisfies Transition,
} as const;

export const T = {
  fast: { duration: DUR.fast, ease: EASE.standard } satisfies Transition,
  base: { duration: DUR.base, ease: EASE.standard } satisfies Transition,
  slow: { duration: DUR.slow, ease: EASE.out } satisfies Transition,
  slower: { duration: DUR.slower, ease: EASE.out } satisfies Transition,
};

/** Press feedback for whileTap. */
export const PRESS = { scale: 0.97 } as const;
/** Hover lift for cards (whileHover). */
export const LIFT = { y: -4, transition: SPRING.soft } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: T.slow },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: T.slow },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: SPRING.soft },
};

/** Parent variant: staggers its children's `show`. */
export function stagger(each = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: each, delayChildren } },
  };
}

/** whileInView defaults: reveal once, a little before the element is fully in. */
export const IN_VIEW = { once: true, amount: 0.25 } as const;
