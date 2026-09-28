// Recent admin audit entries, newest first. Admin-gated.
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const { data, error } = await actor.svc
    .from('admin_audit_log')
    .select('id, actor_email, action, target_email, target_user_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return apiError(500, 'query_failed', error.message);
  return apiOk({ entries: data ?? [] });
}
