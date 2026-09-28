// Verification (blue tick) application. Server re-checks the rule — a store
// qualifies once it has 30+ reviews averaging 4.0+ stars. RLS scopes the
// update to the owner's own store row.
import { requireSeller, getOwnStore } from '@/lib/auth';
import { revalidateStore } from '@/lib/revalidate';
import { apiError, apiOk, internalError } from '@/lib/api';

const REVIEWS_REQUIRED = 30;
const AVG_REQUIRED = 4.0;

export async function POST() {
  try {
    const sb = await requireSeller();
    const store = await getOwnStore<{ id: string; slug: string; verification_status: string }>(sb, 'id, slug, verification_status');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    if (store.verification_status === 'verified') {
      return apiOk({ verified: true, alreadyVerified: true });
    }

    const { data: stats } = await sb
      .from('store_rating_stats')
      .select('review_count, avg_stars')
      .eq('store_id', store.id)
      .maybeSingle();

    const reviewCount = Number(stats?.review_count ?? 0);
    const avg = Number(stats?.avg_stars ?? 0);

    if (reviewCount < REVIEWS_REQUIRED || avg < AVG_REQUIRED) {
      return apiError(
        403,
        'not_eligible',
        `Not eligible yet — you need ${REVIEWS_REQUIRED} reviews averaging ${AVG_REQUIRED}+ stars. You have ${reviewCount} review${reviewCount === 1 ? '' : 's'}${reviewCount > 0 ? ` averaging ${avg.toFixed(1)}` : ''}.`
      );
    }

    const { error } = await sb
      .from('stores')
      .update({ verification_status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', store.id);
    if (error) return internalError('verification apply update', error);

    await revalidateStore(store.slug);
    return apiOk({ verified: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError(401, 'unauthenticated', 'Sign in to your seller account first.');
    }
    return internalError('verification apply', err);
  }
}
