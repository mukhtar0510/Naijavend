// Feature flags — one place to switch product surfaces on and off without
// deleting code. Every flag defaults to OFF, so a production deploy never
// exposes a half-finished surface just because the code shipped.
//
// Enable locally by exporting NEXT_PUBLIC_FLAG_<NAME>=on (see .env.example).
// NEXT_PUBLIC_ prefix so client components and server components read the same
// value at build time.

function flag(name: string, fallback = false): boolean {
  const raw = process.env[`NEXT_PUBLIC_FLAG_${name}`];
  if (raw == null || raw === '') return fallback;
  return raw === 'on' || raw === '1' || raw === 'true';
}

export const FEATURES = {
  /** Dropshipper workflow: supplier copy, badges and shipping windows. */
  dropshipperMode: flag('DROPSHIPPER'),
  /**
   * Public rankings page and the weighted ranking chips on store pages.
   * ON by default: rankings now ship scoped to Kwara State, so the board is
   * useful from day one instead of waiting for a store-count threshold.
   * Set NEXT_PUBLIC_FLAG_RANKINGS=off to hide it again.
   */
  rankings: flag('RANKINGS', true),
  /** Advanced multi-branch tools (branch CRUD, per-branch hours/KPIs). */
  multiBranchTools: flag('MULTI_BRANCH'),
  /** Heavy storefront customisation (layout picker, section colours, fonts). */
  storefrontCustomisation: flag('STOREFRONT_CUSTOMISATION'),
  /**
   * Labelled example stores (is_example) on Discover, Home, Search and the map.
   * ON by default so the marketplace isn't empty before real sellers join;
   * set NEXT_PUBLIC_FLAG_EXAMPLE_STORES=off to hide every one of them at once.
   * Example stores never take orders either way (create-order rejects them).
   */
  exampleStores: flag('EXAMPLE_STORES', true),
} as const;

/** `is_example` values a public store list may include (for `.in('is_example', …)`). */
export const LISTED_EXAMPLE_VALUES: boolean[] = FEATURES.exampleStores ? [false, true] : [false];

export type FeatureKey = keyof typeof FEATURES;

export function isEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}

/**
 * Online payments are deliberately not built. No gateway, no wallet, no card
 * form. This constant exists so a check can fail loudly if someone adds one.
 */
export const ONLINE_PAYMENTS_ENABLED = false;
