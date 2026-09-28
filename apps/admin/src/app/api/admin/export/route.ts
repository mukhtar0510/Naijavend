// CSV export of the users directory — admin-gated, service-role read.
import { requireAdminActor } from '@/lib/admin';
import { apiError } from '@/lib/api';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const { data, error } = await svc
    .from('users_overview')
    .select('id, email, role, created_at, last_sign_in_at, order_count, review_count, store_name, banned_until')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) return apiError(500, 'query_failed', error.message);

  const header = ['id', 'email', 'role', 'created_at', 'last_sign_in_at', 'orders', 'reviews', 'store', 'banned'];
  const lines = [header.join(',')];
  for (const u of data ?? []) {
    const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
    lines.push(
      [u.id, u.email, u.role, u.created_at, u.last_sign_in_at, u.order_count, u.review_count, u.store_name, banned ? 'yes' : 'no']
        .map(csvEscape)
        .join(','),
    );
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="naijavend-users-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
