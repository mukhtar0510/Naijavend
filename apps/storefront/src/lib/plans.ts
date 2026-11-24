// Plans and limits — the single source of truth for what a seller's plan lets
// them do. Paid plans are bought in /dashboard/plan (bank transfer to Kwaravend, confirmed in /admin).
// The `stores.plan` column maps to these public plan names.
// Three plans since 2026-11-23: Free (₦0), Business (id 'growth', ₦5,000/mo) and
// Emirates Plus (id 'plus', ₦12,500/mo; prices raised by the owner on 2026-11-23). On sale since 2026-11-22; plan_expires_at
// ends a paid plan. The Kwaravend rider is an add-on bought with the plan
// (riderPrice per month), active until stores.rider_expires_at.

import { BUSINESS_TEMPLATE_COUNT, PLUS_TEMPLATES, type Plan } from '@idevtenancy/shared';

export type PlanId = 'free' | 'growth' | 'plus';
export type RiderId = 'standard' | 'express' | 'same-day';

export type LimitKey = 'listings' | 'staff' | 'locations' | 'templates';

export interface PlanLimits {
  /** null = unlimited. */
  listings: number | null;
  staff: number | null;
  locations: number | null;
  /** Number of storefront templates the plan may publish. null = all of them. */
  templates: number | null;
  /** null = no dedicated rider; 'same-day' means same-day delivery available. */
  rider?: RiderId | null;
  /** Additional monthly rider fee on top of base plan price. */
  riderPrice: number | null;
}

export interface PlanDef {
  id: PlanId;
  /** Public name used on the landing page and in the dashboard. */
  name: string;
  priceLabel: string;
  /** Additional monthly rider fee on top of base plan price. */
  riderPriceLabel?: string;
  /** Paid tiers are visible but cannot be bought yet. */
  available: boolean;
  tagline: string;
  limits: PlanLimits;
  includes: string[];
  /** Rider assignment for this plan. */
  rider?: RiderId | null;
}

/**
 * Kwaravend's own riders are not running yet (24 Nov 2026). While this is true
 * the rider add-on cannot be bought or used and every surface says "coming
 * soon". A seller's OWN riders and the dispatch board are free on every plan.
 */
export const KWARAVEND_RIDERS_COMING_SOON = true;

export const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '₦0',
    riderPriceLabel: '',
    available: true,
    tagline: 'Everything you need to take your first orders, including 7 storefront templates.',
    limits: { listings: 25, staff: 2, locations: 1, templates: 7, rider: null, riderPrice: null },
    includes: [
      'Public store page at /s/your-name',
      'Up to 25 active listings',
      '7 starter storefront templates',
      'AI theme designer for your storefront',
      'Orders, bookings and buyer chat',
      'Add your own riders and dispatch deliveries',
      'WhatsApp hand-off for every order',
      'Rankings and reviews',
    ],
  },
  {
    id: 'growth',
    name: 'Business',
    priceLabel: '₦5,000/mo',
    riderPriceLabel: '',
    available: true,
    tagline: 'For a shop that is selling every week.',
    // Every template except the Emirates Plus-only designs.
    limits: { listings: 100, staff: 5, locations: 2, templates: BUSINESS_TEMPLATE_COUNT, rider: 'standard', riderPrice: 500 },
    includes: [
      'Everything in Free',
      'Up to 100 active listings',
      'Up to 5 staff accounts with roles',
      'Up to 2 locations',
      'Deeper analytics and delivery reports',
      `All ${BUSINESS_TEMPLATE_COUNT} storefront templates`,
      'Discount codes',
      'Kwaravend rider delivery (coming soon)',
    ],
  },
  {
    id: 'plus',
    name: 'Emirates Plus',
    priceLabel: '₦12,500/mo',
    riderPriceLabel: '',
    available: true,
    tagline: 'For a shop that has outgrown a one-person operation.',
    limits: { listings: null, staff: 25, locations: 10, templates: null, rider: 'express', riderPrice: 1000 },
    includes: [
      'Everything in Business',
      'Unlimited listings',
      `${PLUS_TEMPLATES.length} storefront designs only on Emirates Plus (${PLUS_TEMPLATES.map((t) => t.name).join(', ')})`,
      'Up to 25 staff seats',
      'Up to 10 locations with per-location hours',
      'Customer CRM and notes',
      'Your own domain name',
      'Priority support',
      'Express and same-day Kwaravend riders (coming soon)',
    ],
  },
];

const BY_ID: Record<PlanId, PlanDef> = {
  free: PLANS[0]!,
  growth: PLANS[1]!,
  plus: PLANS[2]!,
};

/** Map the database enum (or a missing value) onto a plan definition. */
export function planFor(plan: Plan | string | null | undefined): PlanDef {
  // Business Pro was folded into Emirates Plus on 2026-11-23 (no store was on it).
  if (plan === 'pro') return BY_ID.plus;
  if (plan === 'plus') return BY_ID.plus;
  if (plan === 'growth') return BY_ID.growth;
  return BY_ID.free;
}

/** Map a plan's rider field to a human label. */
export function riderLabel(rider: RiderId | null): string {
  if (KWARAVEND_RIDERS_COMING_SOON) return 'Coming soon';
  if (!rider) return 'No dedicated rider';
  return {
    standard: 'Standard Kwaravend rider',
    express: 'Express + same-day Kwaravend rider',
    'same-day': 'Same-day Kwaravend rider',
  }[rider];
}


export const LIMIT_LABELS: Record<LimitKey, string> = {
  listings: 'Active listings',
  staff: 'Staff seats',
  locations: 'Locations',
  templates: 'Storefront templates',
};

/** 0–100 for a usage meter. Unlimited plans always read as 0% used. */
export function usagePercent(used: number, limit: number | null): number {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function isAtLimit(used: number, limit: number | null): boolean {
  return limit != null && used >= limit;
}

// ------------------------------------------------------------- T11 gating
/** Features a plan can unlock (BUILD.md T11). */
export type FeatureKeyPlan = 'crm' | 'dispatch' | 'reports' | 'discounts' | 'custom_domain' | 'priority_support' | 'kwaravend_rider';

/** Lowest plan that includes each feature. Free gets none of these when gating is on. */
const FEATURE_MIN_PLAN: Record<FeatureKeyPlan, PlanId> = {
  reports: 'growth',
  discounts: 'growth',
  kwaravend_rider: 'growth',
  crm: 'plus',
  // Own riders and the dispatch board are free for every seller (24 Nov 2026).
  dispatch: 'free',
  custom_domain: 'plus',
  priority_support: 'plus',
};
const PLAN_RANK: Record<PlanId, number> = { free: 0, growth: 1, plus: 2 };

/**
 * hasFeature(store, key): whether this store's plan includes a feature.
 * When gating is off (FEATURES.planGating) every store gets everything;
 * when on, the store's effective (unexpired) plan decides.
 */
export function hasFeature(store: { plan?: string | null; plan_expires_at?: string | null } | null | undefined, key: FeatureKeyPlan, gatingOn: boolean): boolean {
  if (!gatingOn) return true;
  return PLAN_RANK[effectivePlan(store).id] >= PLAN_RANK[FEATURE_MIN_PLAN[key]];
}

/** Name of the plan that unlocks a feature, for locked-state copy. */
export function planNameFor(key: FeatureKeyPlan): string {
  return PLANS.find((p) => p.id === FEATURE_MIN_PLAN[key])?.name ?? 'a paid plan';
}

// ------------------------------------------------------------- paid plans
/**
 * The plan a store is actually on right now: its paid plan while
 * `plan_expires_at` is in the future (or unset for Free), otherwise Free.
 * Paid plans are bought per month (see /dashboard/plan and admin Billing).
 */
export function effectivePlan(store: { plan?: string | null; plan_expires_at?: string | null } | null | undefined): PlanDef {
  const def = planFor(store?.plan);
  if (def.id === 'free') return def;
  const exp = store?.plan_expires_at ? Date.parse(store.plan_expires_at) : NaN;
  return Number.isFinite(exp) && exp > Date.now() ? def : planFor('free');
}

/** Monthly price in kobo, from the plan's ₦ label (single source of truth). */
export function planPriceKobo(id: PlanId): number {
  const label = PLANS.find((p) => p.id === id)?.priceLabel ?? '₦0';
  return Number(label.replace(/[^0-9]/g, '') || 0) * 100;
}

/** Whether the store's Kwaravend rider add-on is paid up (needs a plan with a rider). */
export function riderActive(store: { plan?: string | null; plan_expires_at?: string | null; rider_expires_at?: string | null } | null | undefined): boolean {
  if (KWARAVEND_RIDERS_COMING_SOON) return false;
  const plan = effectivePlan(store);
  if (!plan.limits.rider) return false;
  const exp = store?.rider_expires_at ? Date.parse(store.rider_expires_at) : NaN;
  return Number.isFinite(exp) && exp > Date.now();
}

/** Rider speeds a plan may request. */
export function riderSpeeds(plan: PlanDef): Array<'standard' | 'express' | 'same_day'> {
  if (plan.limits.rider === 'express' || plan.limits.rider === 'same-day') return ['standard', 'express', 'same_day'];
  if (plan.limits.rider === 'standard') return ['standard'];
  return [];
}
