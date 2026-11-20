// Admin stores directory: every storefront with its owner and listing count.
// Admin-gated, service-role read (RLS would otherwise hide other owners' rows).
import { NextRequest } from 'next/server';
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  plan: string | null;
  verification_status: string | null;
  created_at: string;
  owner_id: string | null;
  listings: Array<{ count: number }> | { count: number } | null;
}

function listingCount(value: StoreRow['listings']): number {
  if (!value) return 0;
  return Array.isArray(value) ? Number(value[0]?.count ?? 0) : Number(value.count ?? 0);
}

export async function GET(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc } = actor;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();

  let query = svc
    .from('stores')
    .select('id, name, slug, category, plan, verification_status, created_at, owner_id, listings(count)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (q) query = query.ilike('name', `%${q}%`);

  const [{ data, error }, { data: owners }] = await Promise.all([
    query,
    svc.from('users_overview').select('id, email').limit(2000),
  ]);
  if (error) return apiError(500, 'query_failed', error.message);

  const emailById = new Map((owners ?? []).map((u) => [u.id, u.email as string | null]));
  const stores = ((data ?? []) as unknown as StoreRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    category: s.category,
    plan: s.plan,
    verified: s.verification_status === 'verified',
    createdAt: s.created_at,
    ownerEmail: s.owner_id ? emailById.get(s.owner_id) ?? null : null,
    listingCount: listingCount(s.listings),
  }));

  return apiOk({ stores });
}
