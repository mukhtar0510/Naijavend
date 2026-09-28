import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { Stars } from '@/components/Stars';
import type { StoreRating, StoreRatingStats } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export default async function RatingsPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<
    { id: string; store_rating_stats: StoreRatingStats[] | StoreRatingStats | null }
  >(sb, 'id, store_rating_stats(review_count, avg_stars, weighted_score, overall_rank, category_rank)');
  if (!store) {
    return <main><h1>Ratings</h1><p className="muted">Create your store first.</p></main>;
  }

  const { data: ratings } = await sb
    .from('store_ratings')
    .select('stars, comment, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const stats = ((store as unknown as { store_rating_stats: StoreRatingStats[] }).store_rating_stats ?? [])[0] ?? null;

  return (
    <main>
      <h1>Ratings received</h1>
      {stats && stats.review_count > 0 && (
        <div className="card card-elevated" style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Stars value={Number(stats.avg_stars)} />
          <span className="muted">{stats.review_count} review{stats.review_count === 1 ? '' : 's'}</span>
          {stats.overall_rank && <span className="rank-chip">#{stats.overall_rank} overall · #{stats.category_rank} in your category</span>}
        </div>
      )}
      {(ratings as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[] | null)?.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {(ratings as Pick<StoreRating, 'stars' | 'comment' | 'created_at'>[]).map((r, i) => (
            <div key={i} className="card">
              <Stars value={r.stars} showNumeric={false} />
              {r.comment && <p style={{ margin: '8px 0 0' }}>{r.comment}</p>}
              <p className="muted mono" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                {new Date(r.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No reviews yet. After each sale or booking, ask the customer to rate you — your store link plus /rate.
        </div>
      )}
    </main>
  );
}
