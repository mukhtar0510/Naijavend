// Global search across every entity: accounts, stores, listings, orders.
// Admin-gated, service-role read.
import { NextRequest } from 'next/server';
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return apiOk({ results: [] });
  const like = `%${q}%`;

  const [users, stores, listings, orders] = await Promise.all([
    svc.from('users_overview').select('id, email, role, created_at').ilike('email', like).limit(5),
    svc.from('stores').select('id, name, slug, category, verification_status').or(`name.ilike.${like},slug.ilike.${like}`).limit(5),
    svc.from('listings').select('id, title, price_kobo, store_id, stores(name, slug)').ilike('title', like).limit(5),
    svc.from('orders').select('id, customer_name, total_kobo, status, created_at, store_id, stores(name, slug)').or(`customer_name.ilike.${like},payment_reference.ilike.${like}`).limit(5),
  ]);

  if (users.error || stores.error || listings.error || orders.error) {
    return apiError(500, 'query_failed', users.error?.message ?? stores.error?.message ?? listings.error?.message ?? orders.error?.message ?? 'query failed');
  }

  const results = [
    ...(users.data ?? []).map((u) => ({
      kind: 'user' as const,
      id: u.id,
      title: u.email ?? u.id.slice(0, 8),
      sub: `${u.role} · joined ${new Date(u.created_at).toLocaleDateString()}`,
    })),
    ...(stores.data ?? []).map((s) => ({
      kind: 'store' as const,
      id: s.id,
      title: s.name,
      sub: `/s/${s.slug} · ${s.category} · ${s.verification_status}`,
    })),
    ...(listings.data ?? []).map((l) => {
      const s = Array.isArray(l.stores) ? l.stores[0] : l.stores;
      return {
        kind: 'listing' as const,
        id: l.id,
        title: l.title,
        sub: `${(s as { name?: string } | null)?.name ?? '—'} · ₦${(Number(l.price_kobo) / 100).toLocaleString('en-NG')}`,
      };
    }),
    ...(orders.data ?? []).map((o) => {
      const s = Array.isArray(o.stores) ? o.stores[0] : o.stores;
      return {
        kind: 'order' as const,
        id: o.id,
        title: o.customer_name,
        sub: `${(s as { name?: string } | null)?.name ?? '—'} · ₦${(Number(o.total_kobo) / 100).toLocaleString('en-NG')} · ${o.status} · ${new Date(o.created_at).toLocaleDateString()}`,
      };
    }),
  ];

  return apiOk({ results });
}
