// Admin actions on a single user: ban, unban, delete. All destructive ops are
// admin-gated, service-role executed and audit-logged. Deleting a user removes
// their auth account (cascades to owned stores via FK) — type-to-confirm on the
// client; here the action itself is atomic.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit, adminEmails } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

interface Ctx {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc, email: actorEmail } = actor;

  const userId = params.id;
  let action = '';
  let reason = '';
  try {
    const body = await req.json();
    action = typeof body.action === 'string' ? body.action : '';
    reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : '';
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const { data: target } = await svc.auth.admin.getUserById(userId);
  if (!target?.user) return apiError(404, 'not_found', 'User not found.');
  const targetEmail = target.user.email ?? null;

  switch (action) {
    case 'ban': {
      await svc.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // ~100 years
      await svc.from('banned_users').upsert({ user_id: userId, email: targetEmail, reason: reason || null });
      await audit(actorEmail, 'ban', { email: targetEmail, userId }, { reason });
      return apiOk({ ok: true, action: 'ban' });
    }
    case 'unban': {
      await svc.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      await svc.from('banned_users').delete().eq('user_id', userId);
      await audit(actorEmail, 'unban', { email: targetEmail, userId });
      return apiOk({ ok: true, action: 'unban' });
    }
    case 'delete': {
      // Refuse to delete another admin's account. Exact-match against the
      // parsed admin list — a substring test mis-protected lookalikes
      // (ADMIN_EMAILS="admin@x.com" also matched "dmin@x.com").
      if (targetEmail && adminEmails().includes(targetEmail.toLowerCase())) {
        return apiError(400, 'protected', 'Admin accounts cannot be deleted.');
      }
      await svc.from('banned_users').delete().eq('user_id', userId);
      await svc.auth.admin.deleteUser(userId);
      await audit(actorEmail, 'delete', { email: targetEmail, userId });
      return apiOk({ ok: true, action: 'delete' });
    }
    default:
      return apiError(400, 'bad_action', 'action must be ban, unban or delete.');
  }
}
