// Review moderation: recent reviews across all stores, with delete action.
// Admin-gated, service-role executed, audit-logged.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const { data, error } = await actor.svc
    .from('store_ratings')
    .select('id, store_id, stars, comment, customer_phone, created_at, stores(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return apiError(500, 'query_failed', error.message);

  const reviews = (data ?? []).map((r: Record<string, unknown>) => {
    const { stores, ...rest } = r;
    const s = Array.isArray(stores) ? stores[0] : stores;
    return { ...rest, store_name: (s as { name?: string } | null)?.name ?? null, store_slug: (s as { slug?: string } | null)?.slug ?? null };
  });
  return apiOk({ reviews });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc, email: actorEmail } = actor;

  let action = '';
  let id = '';
  let reason = '';
  try {
    const body = await req.json();
    action = typeof body.action === 'string' ? body.action : '';
    id = typeof body.id === 'string' ? body.id : '';
    reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : '';
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  if (action !== 'delete') return apiError(400, 'bad_action', 'action must be delete.');
  if (!id) return apiError(400, 'missing_id', 'Review id is required.');

  const { data: existing } = await svc.from('store_ratings').select('id, store_id, stars, comment').eq('id', id).maybeSingle();
  if (!existing) return apiError(404, 'not_found', 'Review not found.');

  const { error } = await svc.from('store_ratings').delete().eq('id', id);
  if (error) return apiError(500, 'delete_failed', error.message);

  await audit(actorEmail, 'review_delete', { userId: id }, { store: existing.store_id, stars: existing.stars, reason });
  return apiOk({ ok: true, action: 'delete' });
}
