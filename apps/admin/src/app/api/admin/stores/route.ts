// Admin stores directory: every store with owner + verification state.
// Admin-gated, service-role read.
import { requireAdminActor } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const { data, error } = await actor.svc
    .from('stores')
    .select('id, name, slug, category, business_type, verification_status, is_dropshipper, created_at, owner_id, store_rating_stats(review_count, avg_stars)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return apiError(500, 'query_failed', error.message);

  // Flatten the one-to-one rating embed into per-store counts.
  const stores = (data ?? []).map((s: Record<string, unknown>) => {
    const { store_rating_stats, ...rest } = s;
    const stats = Array.isArray(store_rating_stats) ? store_rating_stats[0] : store_rating_stats;
    return { ...rest, review_count: (stats as { review_count?: number } | null)?.review_count ?? 0, avg_stars: (stats as { avg_stars?: number } | null)?.avg_stars ?? null };
  });
  return apiOk({ stores });
}
