// Seller buys a plan (owner, 22 Nov 2026).
//   POST { plan, months }          start a purchase: amount computed here
//   POST { action: 'cancel', id }  cancel a purchase not paid yet
// The seller then transfers to Kwaravend's account with the reference and
// uploads the receipt (/api/dashboard/plan/proof); the owner confirms in /admin.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { PAID_PLANS, getBillingBank, newPlanReference, planAmountKobo } from '@/lib/billing';
import type { PlanId } from '@/lib/plans';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`plan-buy:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many tries. Wait a minute.');
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(403, 'no_store', 'Only the store owner can buy a plan.');
    const svc = supabaseService();

    if (b.action === 'cancel') {
      const id = sanitizeText(b.id, 40);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid', 'Invalid purchase.');
      const { error } = await svc
        .from('plan_payments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('store_id', store.id)
        .in('status', ['pending', 'awaiting_confirmation']);
      if (error) throw error;
      return apiOk({ cancelled: true });
    }

    const plan = sanitizeText(b.plan, 10) as PlanId;
    const months = Math.round(Number(b.months ?? 1));
    if (!PAID_PLANS.includes(plan)) return apiError(422, 'invalid_plan', 'Pick a paid plan.');
    if (![1, 3, 6, 12].includes(months)) return apiError(422, 'invalid_months', 'Pick 1, 3, 6 or 12 months.');

    const bank = await getBillingBank(svc);
    if (!bank) return apiError(503, 'billing_not_set', 'Plan payments open as soon as Kwaravend adds its bank details. Try again shortly.');

    // One open purchase at a time: replace any unpaid one.
    await svc.from('plan_payments').update({ status: 'cancelled' }).eq('store_id', store.id).eq('status', 'pending');
    const { data, error } = await svc
      .from('plan_payments')
      .insert({ store_id: store.id, plan, months, amount_kobo: planAmountKobo(plan, months), reference: newPlanReference() })
      .select('id, plan, months, amount_kobo, reference, status')
      .single();
    if (error) throw error;
    return apiOk({ payment: data, bank }, 201);
  } catch (err) {
    return internalError('plan-buy', err);
  }
}
