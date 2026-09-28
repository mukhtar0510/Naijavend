import Link from 'next/link';
import { supabaseAnon } from '@/lib/supabase';
import { Stars } from '@/components/Stars';
import { STORE_CATEGORIES, categoryLabel } from '@idevtenancy/shared';
import type { Store, StoreRatingStats, StoreTheme } from '@idevtenancy/shared';

export const revalidate = 60; // ISR — static-fast, invalidated on seller writes via revalidatePath
export const metadata = {
  title: 'Store rankings',
  description: 'The top-rated Nigerian stores and service providers on Naijavend, ranked by verified customer reviews.',
};

const CATEGORIES = STORE_CATEGORIES;

interface RankedStore {
  store: Store;
  stats: StoreRatingStats;
  theme: { logo_url: string | null; favicon_url: string | null } | null;
}

async function getRanked(category?: string, limit = 10): Promise<RankedStore[]> {
  const sb = supabaseAnon();
  let query = sb
    .from('store_rating_stats')
    .select('store_id, review_count, avg_stars, weighted_score, overall_rank, category_rank, stores!inner(*, store_themes(logo_url, favicon_url))')
    .gt('review_count', 0)
    .order('weighted_score', { ascending: false })
    .limit(limit);
  if (category) query = query.eq('stores.category', category);
  const { data } = await query;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const themes = (row.stores as { store_themes?: Array<{ logo_url: string | null; favicon_url: string | null }> } | null)?.store_themes;
    return {
      store: row.stores as unknown as Store,
      theme: themes?.[0] ?? null,
      stats: {
        store_id: row.store_id as string,
        review_count: row.review_count as number,
        avg_stars: row.avg_stars as number,
        weighted_score: row.weighted_score as number,
        overall_rank: row.overall_rank as number | null,
        category_rank: row.category_rank as number | null,
        updated_at: '',
      },
    };
  });
}

const MEDALS = ['🥇', '🥈', '🥉'];

function RankLogo({ store, theme, size = 46 }: { store: Store; theme: RankedStore['theme']; size?: number }) {
  const logo = theme?.logo_url ?? theme?.favicon_url ?? null;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
      <img className="rank-logo" src={logo} alt="" loading="lazy" decoding="async" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rank-logo-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {store.name.charAt(0).toUpperCase()}
    </div>
  );
}

function Leaderboard({ title, entries }: { title: string; entries: RankedStore[] }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2>{title}</h2>
      {entries.length === 0 ? (
        <div className="empty-state">Not enough reviews yet — be the first to rate a store.</div>
      ) : (
        <>
          {entries.length >= 3 && (
            <div className="podium">
              {entries.slice(0, 3).map((entry, i) => (
                <Link key={entry.store.id} href={`/s/${entry.store.slug}`} className={`podium-step p${i + 1}`} style={{ textDecoration: 'none' }}>
                  <div className="podium-medal">{MEDALS[i]}</div>
                  <RankLogo store={entry.store} theme={entry.theme} size={56} />
                  <h3 style={{ fontSize: 17, margin: '8px 0 2px' }}>{entry.store.name}</h3>
                  {entry.store.is_dropshipper && (
                    <span className="badge badge-dropship" style={{ marginBottom: 6 }}>🚚 Dropshipper</span>
                  )}
                  <Stars value={Number(entry.stats.avg_stars)} showNumeric={false} />
                  <div className="muted" style={{ fontSize: 13 }}>
                    {Number(entry.stats.avg_stars).toFixed(1)} · {entry.stats.review_count} review{entry.stats.review_count === 1 ? '' : 's'}
                  </div>
                </Link>
              ))}
            </div>
          )}
          <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10, margin: 0 }}>
            {entries.slice(entries.length >= 3 ? 3 : 0).map((entry) => {
              const displayNum = entries.indexOf(entry) + 1;
              return (
                <li key={entry.store.id}>
                  <Link href={`/s/${entry.store.slug}`} className="card rank-row">
                    <span className="rank-num">{displayNum}</span>
                    <RankLogo store={entry.store} theme={entry.theme} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {entry.store.name}
                        {entry.store.is_dropshipper && <span className="badge badge-dropship">🚚 Dropshipper</span>}
                      </strong>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Stars value={Number(entry.stats.avg_stars)} />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {entry.stats.review_count} review{entry.stats.review_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <span className="muted" style={{ fontSize: 13.5 }}>Visit →</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

export default async function RankingsPage() {
  const overall = await getRanked();
  const categoryBoards = await Promise.all(
    CATEGORIES.map(async (c) => ({ category: c, entries: await getRanked(c, 5) }))
  );
  const withEntries = categoryBoards.filter((b) => b.entries.length > 0);

  return (
    <main>
      <div className="page-intro page-intro-gold">
        <div className="container">
          <h1>🏆 Top-rated stores</h1>
          <p>
            Rankings use verified customer reviews weighted so that many consistent reviews count for more than one
            perfect score. Only stores with at least one review appear.
          </p>
        </div>
      </div>
      <div className="container" style={{ padding: '28px 20px' }}>
      <Leaderboard title="Overall" entries={overall} />
      {withEntries.map((board) => (
        <Leaderboard key={board.category} title={`Best in ${categoryLabel(board.category)}`} entries={board.entries} />
      ))}
      </div>
    </main>
  );
}
