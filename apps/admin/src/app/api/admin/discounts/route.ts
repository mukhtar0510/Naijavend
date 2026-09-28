// Discount/coupon management: platform-wide directory with create + activate/
// deactivate actions. Admin-gated, service-role, audit-logged.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const { data, error } = await actor.svc
    .from('discount_codes')
    .select('id, store_id, code, percent_off, active, usage_count, max_uses, created_at, stores(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return apiError(500, 'query_failed', error.message);

  const discounts = (data ?? []).map((d: Record<string, unknown>) => {
    const { stores, ...rest } = d;
    const s = Array.isArray(stores) ? stores[0] : stores;
    return { ...rest, store_name: (s as { name?: string } | null)?.name ?? null, store_slug: (s as { slug?: string } | null)?.slug ?? null };
  });
  return apiOk({ discounts });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc, email: actorEmail } = actor;

  let action = '';
  let id = '';
  let code = '';
  let storeId = '';
  let percentOff = 0;
  let maxUses: number | null = null;
  try {
    const body = await req.json();
    action = typeof body.action === 'string' ? body.action : '';
    id = typeof body.id === 'string' ? body.id : '';
    code = typeof body.code === 'string' ? body.code.trim().toUpperCase().slice(0, 40) : '';
    storeId = typeof body.store_id === 'string' ? body.store_id : '';
    percentOff = typeof body.percent_off === 'number' ? Math.round(body.percent_off) : 0;
    maxUses = typeof body.max_uses === 'number' && body.max_uses > 0 ? Math.round(body.max_uses) : null;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  if (action === 'create') {
    if (!code) return apiError(400, 'missing_code', 'Code is required.');
    if (percentOff < 1 || percentOff > 90) return apiError(400, 'bad_percent', 'percent_off must be between 1 and 90.');
    if (!storeId) return apiError(400, 'missing_store', 'store_id is required — pick the store the coupon belongs to.');
    const { data: store } = await svc.from('stores').select('id').eq('id', storeId).maybeSingle();
    if (!store) return apiError(404, 'not_found', 'Store not found.');
    const { error } = await svc.from('discount_codes').insert({ store_id: storeId, code, percent_off: percentOff, max_uses: maxUses });
    if (error) return apiError(500, 'insert_failed', error.message);
    await audit(actorEmail, 'discount_create', { userId: storeId }, { code, percentOff, maxUses });
    return apiOk({ ok: true, action: 'create' });
  }

  if (action === 'activate' || action === 'deactivate') {
    if (!id) return apiError(400, 'missing_id', 'Discount id is required.');
    const { error } = await svc.from('discount_codes').update({ active: action === 'activate' }).eq('id', id);
    if (error) return apiError(500, 'update_failed', error.message);
    await audit(actorEmail, `discount_${action}`, { userId: id });
    return apiOk({ ok: true, action });
  }

  return apiError(400, 'bad_action', 'action must be create, activate or deactivate.');
}
