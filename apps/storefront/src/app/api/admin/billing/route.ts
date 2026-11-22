// Owner billing (22 Nov 2026): confirm plan payments, set Kwaravend's bank
// account for plan transfers. Every write is in the audit log.
//   GET                                     purchases + bank details
//   POST { action: 'confirm', id }          money arrived: activate the plan
//   POST { action: 'reject', id, note }     money didn't arrive
//   POST { action: 'bank', bankName, accountName, accountNumber }
import { NextRequest } from 'next/server';
import { audit, requireAdminActor } from '@/lib/admin';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { BANK_SETTING_KEY, getBillingBank, nextExpiry } from '@/lib/billing';
import type { PlanId } from '@/lib/plans';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  try {
    const [{ data, error }, bank] = await Promise.all([
      actor.svc
        .from('plan_payments')
        .select('id, plan, months, amount_kobo, reference, status, proof_url, note, created_at, confirmed_at, confirmed_by, stores(id, name, slug, plan, plan_expires_at)')
        .order('created_at', { ascending: false })
        .limit(200),
      getBillingBank(actor.svc),
    ]);
    if (error) throw error;
    return apiOk({ payments: data ?? [], bank });
  } catch (err) {
    return internalError('admin-billing', err);
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const { svc } = actor;
  try {
    if (b.action === 'bank') {
      const bankName = sanitizeText(b.bankName, 60);
      const accountName = sanitizeText(b.accountName, 80);
      const accountNumber = sanitizeText(b.accountNumber, 20).replace(/\D/g, '');
      if (bankName.length < 2 || accountName.length < 2 || !/^\d{10}$/.test(accountNumber)) {
        return apiError(422, 'invalid_bank', 'Enter the bank, account name and a 10-digit account number.');
      }
      const { error } = await svc
        .from('platform_settings')
        .upsert({ key: BANK_SETTING_KEY, value: { bankName, accountName, accountNumber }, updated_at: new Date().toISOString(), updated_by: actor.email });
      if (error) throw error;
      await audit(actor.email, 'billing_bank_updated', undefined, { bankName, last4: accountNumber.slice(-4) });
      return apiOk({ saved: true });
    }

    const id = sanitizeText(b.id, 40);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid', 'Invalid purchase.');
    const { data: pay } = await svc.from('plan_payments').select('id, store_id, plan, months, status, reference').eq('id', id).maybeSingle();
    if (!pay) return apiError(404, 'not_found', 'Purchase not found.');
    if (!['pending', 'awaiting_confirmation'].includes(pay.status)) return apiError(409, 'closed', `Already ${pay.status}.`);

    if (b.action === 'reject') {
      const note = sanitizeText(b.note, 200) || 'Payment not received';
      const { error } = await svc.from('plan_payments').update({ status: 'rejected', note, confirmed_by: actor.email, confirmed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      await audit(actor.email, 'plan_payment_rejected', undefined, { id, reference: pay.reference, note });
      return apiOk({ updated: true });
    }

    if (b.action === 'confirm') {
      const { data: store } = await svc.from('stores').select('id, plan, plan_expires_at').eq('id', pay.store_id).maybeSingle();
      if (!store) return apiError(404, 'no_store', 'Store not found.');
      const expires = nextExpiry(store, pay.plan as PlanId, pay.months);
      // Service role: the plan guard trigger lets the server change the plan.
      const { error: sErr } = await svc.from('stores').update({ plan: pay.plan, plan_expires_at: expires }).eq('id', pay.store_id);
      if (sErr) throw sErr;
      const { error } = await svc.from('plan_payments').update({ status: 'paid', confirmed_by: actor.email, confirmed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      await audit(actor.email, 'plan_activated', undefined, { id, reference: pay.reference, storeId: pay.store_id, plan: pay.plan, months: pay.months, expires });
      return apiOk({ updated: true, expires });
    }
    return apiError(422, 'invalid_action', 'Unknown action.');
  } catch (err) {
    return internalError('admin-billing', err);
  }
}
