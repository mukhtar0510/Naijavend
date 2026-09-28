// Listing moderation: recent listings across all stores, with delete action
// for counterfeit/prohibited item takedowns. Admin-gated, service-role,
// audit-logged.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const { data, error } = await actor.svc
    .from('listings')
    .select('id, store_id, type, title, price_kobo, stock, created_at, stores(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return apiError(500, 'query_failed', error.message);

  const listings = (data ?? []).map((l: Record<string, unknown>) => {
    const { stores, ...rest } = l;
    const s = Array.isArray(stores) ? stores[0] : stores;
    return { ...rest, store_name: (s as { name?: string } | null)?.name ?? null, store_slug: (s as { slug?: string } | null)?.slug ?? null };
  });
  return apiOk({ listings });
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
  if (!id) return apiError(400, 'missing_id', 'Listing id is required.');

  const { data: existing } = await svc.from('listings').select('id, title, store_id').eq('id', id).maybeSingle();
  if (!existing) return apiError(404, 'not_found', 'Listing not found.');

  const { error } = await svc.from('listings').delete().eq('id', id);
  if (error) return apiError(500, 'delete_failed', error.message);

  await audit(actorEmail, 'listing_delete', { userId: id }, { title: existing.title, store: existing.store_id, reason });
  return apiOk({ ok: true, action: 'delete' });
}
