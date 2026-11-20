// Plans and limits — the single source of truth for what a seller's plan lets
// them do. This is a MOCK setup: there is no billing, no card form and no gateway.
// The `stores.plan` column maps to these public plan names.
// Prices were set on 2026-11-18: Free (₦0), Business (₦3,000/mo), Business Plus (₦8,000/mo),
// Business Pro (₦15,000/mo). Billing is not switched on yet, so no plan can be paid for.
// Rider delivery fees are additional monthly fees on top of the base plan price.

import type { Plan } from '@idevtenancy/shared';

export type PlanId = 'free' | 'growth' | 'plus' | 'pro';
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
      'WhatsApp hand-off for every order',
      'Rankings and reviews',
    ],
  },
  {
    id: 'growth',
    name: 'Business',
    priceLabel: '₦3,000/mo',
    riderPriceLabel: '₦500/mo rider',
    available: false,
    tagline: 'For a shop that is selling every week, with Standard Kwaravend rider delivery.',
    limits: { listings: 100, staff: 5, locations: 2, templates: null, rider: 'standard', riderPrice: 500 },
    includes: [
      'Everything in Free',
      'Up to 100 active listings',
      'Staff accounts with roles',
      'Deeper analytics',
      'All 20 storefront templates',
      'Discount codes',
      'Standard Kwaravend rider delivery',
    ],
  },
  {
    id: 'plus',
    name: 'Business Plus',
    priceLabel: '₦8,000/mo',
    riderPriceLabel: '₦1,000/mo rider',
    available: false,
    tagline: 'For a shop that has outgrown a one-person operation, with Express Kwaravend rider delivery.',
    limits: { listings: 250, staff: 10, locations: 3, templates: null, rider: 'express', riderPrice: 1000 },
    includes: [
      'Everything in Business',
      'Up to 250 listings',
      'Multiple locations and per-location hours',
      'Customer CRM and notes',
      'Priority support',
      'Express Kwaravend rider delivery',
    ],
  },
  {
    id: 'pro',
    name: 'Business Pro',
    priceLabel: '₦15,000/mo',
    riderPriceLabel: '₦2,000/mo rider',
    available: false,
    tagline: 'For multi-branch retailers and delivery-heavy catalogues, with Same-day Kwaravend rider delivery.',
    limits: { listings: null, staff: 25, locations: 10, templates: null, rider: 'same-day', riderPrice: 2000 },
    includes: [
      'Everything in Business Plus',
      'Unlimited listings',
      'Up to 25 staff seats',
      'Up to 10 locations',
      'Custom domain and advanced dispatch',
      'Same-day Kwaravend rider delivery',
    ],
  },
];

const BY_ID: Record<PlanId, PlanDef> = {
  free: PLANS[0]!,
  growth: PLANS[1]!,
  plus: PLANS[2]!,
  pro: PLANS[3]!,
};

/** Map the database enum (or a missing value) onto a plan definition. */
export function planFor(plan: Plan | string | null | undefined): PlanDef {
  if (plan === 'pro') return BY_ID.pro;
  if (plan === 'plus') return BY_ID.plus;
  if (plan === 'growth') return BY_ID.growth;
  return BY_ID.free;
}

/** Map a plan's rider field to a human label. */
export function riderLabel(rider: RiderId | null): string {
  if (!rider) return 'No dedicated rider';
  return {
    standard: 'Standard Kwaravend rider',
    express: 'Express Kwaravend rider',
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
