// Paid plans (owner, 22 Nov 2026). Server-only helpers. Sellers pay Kwaravend
// by bank transfer (Paystack later, through lib/payment-provider.ts); the owner
// confirms the money in /admin and the plan runs until plan_expires_at.

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanId } from './plans';
import { planFor, planPriceKobo } from './plans';

export const PAID_PLANS: PlanId[] = ['growth', 'plus'];
export const BANK_SETTING_KEY = 'billing_bank';
export const DAYS_PER_MONTH = 30;

export interface BillingBank {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export function newPlanReference(): string {
  // KVP- + 8 unambiguous characters, e.g. KVP-7H3KQ9MD
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(8);
  return `KVP-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

/** Monthly Kwaravend rider add-on price in kobo for a plan (0 if none). */
export function riderPriceKobo(plan: PlanId): number {
  return (planFor(plan).limits.riderPrice ?? 0) * 100;
}

export function planAmountKobo(plan: PlanId, months: number, rider = false): number {
  return (planPriceKobo(plan) + (rider ? riderPriceKobo(plan) : 0)) * months;
}

/** Rider add-on expiry: extend a running add-on, else start from now. */
export function nextRiderExpiry(current: { rider_expires_at?: string | null }, months: number): string {
  const now = Date.now();
  const cur = current.rider_expires_at ? Date.parse(current.rider_expires_at) : NaN;
  const base = Number.isFinite(cur) && cur > now ? cur : now;
  return new Date(base + months * DAYS_PER_MONTH * 86_400_000).toISOString();
}

/** Kwaravend's own account for plan payments, set by the owner in /admin. */
export async function getBillingBank(svc: SupabaseClient): Promise<BillingBank | null> {
  const { data } = await svc.from('platform_settings').select('value').eq('key', BANK_SETTING_KEY).maybeSingle();
  const v = (data as { value?: Partial<BillingBank> } | null)?.value;
  return v?.bankName && v.accountName && v.accountNumber ? { bankName: v.bankName, accountName: v.accountName, accountNumber: v.accountNumber } : null;
}

/** New expiry: extend from the current expiry when renewing the same plan early, else from now. */
export function nextExpiry(current: { plan?: string | null; plan_expires_at?: string | null }, plan: PlanId, months: number): string {
  const now = Date.now();
  const cur = current.plan_expires_at ? Date.parse(current.plan_expires_at) : NaN;
  const base = current.plan === plan && Number.isFinite(cur) && cur > now ? cur : now;
  return new Date(base + months * DAYS_PER_MONTH * 86_400_000).toISOString();
}
