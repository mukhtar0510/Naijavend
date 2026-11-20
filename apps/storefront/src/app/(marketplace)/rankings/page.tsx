import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Star,
  Store as StoreIcon,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { supabaseAnon } from '@/lib/supabase';
import { Stars } from '@/components/Stars';
import { VerifiedTick } from '@/components/VerifiedTick';
import { Reveal, Stagger, StaggerItem } from '@/components/brand/Motion';
import { STORE_CATEGORIES, categoryEmoji, categoryLabel } from '@idevtenancy/shared';
import type { Store, StoreRatingStats } from '@idevtenancy/shared';

// Rankings launch scoped to one state, so a small board is still a useful one.
// Stores are filtered by their pinned coordinates, with the address as a
// fallback for sellers who have not dropped a pin yet.
export const revalidate = 60;
export const metadata = {
  title: 'Store rankings in Ilorin',
  description:
    'The top-rated stores and service providers in Ilorin, Kwara State, ranked by verified customer reviews. Browse overall or by trade.',
};

const KWARA_BOUNDS = { minLat: 7.8, maxLat: 10.2, minLng: 2.6, maxLng: 6.2 };

function inKwara(store: Store): boolean {
  const { latitude: lat, longitude: lng } = store;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return (
      lat >= KWARA_BOUNDS.minLat &&
      lat <= KWARA_BOUNDS.maxLat &&
      lng >= KWARA_BOUNDS.minLng &&
      lng <= KWARA_BOUNDS.maxLng
    );
  }
  return /kwara|ilorin/i.test(store.address ?? '');
}

interface RankedStore {
  store: Store;
  stats: StoreRatingStats;
  theme: { logo_url: string | null; favicon_url: string | null } | null;
}

async function getRanked(category?: string, limit = 100): Promise<RankedStore[]> {
  const sb = supabaseAnon();
  let query = sb
    .from('store_rating_stats')
    .select('store_id, review_count, avg_stars, weighted_score, overall_rank, category_rank, stores!inner(*, store_themes(logo_url, favicon_url))')
    .gt('review_count', 0)
    .order('weighted_score', { ascending: false })
    .limit(100);
  if (category) query = query.eq('stores.category', category);
  const { data } = await query;
  const ranked = (data ?? []).map((row: Record<string, unknown>) => {
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
  // Fetch wide, then keep only Kwara stores — the board is state-scoped.
  return ranked.filter((entry) => inKwara(entry.store)).slice(0, limit);
}

const MEDALS = ['🥇', '🥈', '🥉'];

function RankLogo({
  store,
  theme,
  size = 46,
  className = '',
}: {
  store: Store;
  theme: RankedStore['theme'];
  size?: number;
  className?: string;
}) {
  const logo = theme?.logo_url ?? theme?.favicon_url ?? null;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
      <img
        className={`nv-rank-logo ${className}`}
        src={logo}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`nv-rank-logo is-fallback ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {store.name.charAt(0).toUpperCase()}
    </span>
  );
}

const RULES = [
  {
    Icon: ShieldCheck,
    title: 'Purchases only',
    text: 'Only a buyer with a real order or booking can rate a store. No drive-by stars.',
  },
  {
    Icon: TrendingUp,
    title: 'Weighted, not averaged',
    text: 'The rank score balances the average, how many reviews back it up, and how recent they are.',
  },
  {
    Icon: BadgeCheck,
    title: 'A tick with a rule',
    text: 'The blue tick needs 30+ reviews averaging four stars, and is revoked if review integrity breaks.',
  },
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const rawCategory = searchParams.category ?? '';
  const category = STORE_CATEGORIES.includes(rawCategory as never) ? rawCategory : undefined;
  const entries = await getRanked(category);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const reviewsCounted = entries.reduce((sum, e) => sum + e.stats.review_count, 0);
  const bestScore = entries.reduce((max, e) => Math.max(max, Number(e.stats.weighted_score) || 0), 0);
  const title = category ? `Best in ${categoryLabel(category)}` : 'Overall in Ilorin';
  const href = (value?: string) => (value ? `/rankings?category=${value}` : '/rankings');

  return (
    <main className="nv-rank">
      {/* ================================ HERO ================================ */}
      <section className="nv-rank-hero">
        <div className="nv-rank-hero-canvas" aria-hidden>
          <span className="nv-rank-hero-grid" />
          <span className="nv-rank-orb a" />
          <span className="nv-rank-orb b" />
        </div>

        <div className="container nv-rank-hero-inner">
          <div>
            <Reveal>
              <span className="nv-pill">
                <span className="nv-pill-dot" aria-hidden />
                Public rankings · Ilorin, Kwara State
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="nv-rank-title">
                The stores doing the work,
                <br />
                <span className="nv-grad-text">ranked in the open.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="nv-rank-sub">
                Every score here comes from buyers in Ilorin who actually ordered or booked. No paid
                placement, no sponsored slots — just a weighted record of how sellers treat their
                customers.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.18} className="nv-rank-hero-stats">
            <div className="nv-rank-stat">
              <span className="nv-rank-stat-ico" aria-hidden>
                <StoreIcon size={16} />
              </span>
              <strong>{entries.length}</strong>
              <span>stores on this board</span>
            </div>
            <div className="nv-rank-stat">
              <span className="nv-rank-stat-ico" aria-hidden>
                <MessageSquareQuote size={16} />
              </span>
              <strong>{reviewsCounted.toLocaleString()}</strong>
              <span>verified reviews counted</span>
            </div>
            <div className="nv-rank-stat">
              <span className="nv-rank-stat-ico" aria-hidden>
                <Trophy size={16} />
              </span>
              <strong>{bestScore > 0 ? bestScore.toFixed(2) : '—'}</strong>
              <span>top rank score</span>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="container nv-rank-body">
        {/* ============================== FILTERS ============================== */}
        <nav className="nv-rank-cats" aria-label="Ranking category">
          <Link href={href()} className={`nv-rank-cat${!category ? ' is-active' : ''}`}>
            <span aria-hidden>🏆</span> All trades
          </Link>
          {STORE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={href(c)}
              className={`nv-rank-cat${category === c ? ' is-active' : ''}`}
            >
              <span aria-hidden>{categoryEmoji(c)}</span>
              {categoryLabel(c)}
            </Link>
          ))}
        </nav>

        <div className="nv-rank-layout">
          <div className="nv-rank-main">
            <div className="nv-rank-board-head">
              <div>
                <h2>{title}</h2>
                <p>
                  {category
                    ? `Top ${entries.length} in ${categoryLabel(category)} by weighted review score.`
                    : `The top ${entries.length} stores across every trade in Ilorin.`}
                </p>
              </div>
              <Link href="/faq" className="nv-section-link">
                How ranking works <ArrowRight size={15} />
              </Link>
            </div>

            {entries.length === 0 ? (
              <div className="nv-rank-empty">
                <span aria-hidden>🏅</span>
                <h3>Not enough reviews yet</h3>
                <p>
                  {category
                    ? `No ${categoryLabel(category)} store has a review yet. Be the first to rate one.`
                    : 'The first reviewed store will take this board. Be the first to rate a store.'}
                </p>
                <Link href="/discover" className="btn btn-primary btn-sm">
                  Find a store to rate <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <>
                {/* ------------------------------ PODIUM ------------------------------ */}
                <Stagger className="nv-rank-podium">
                  {podium.map((entry, i) => (
                    <StaggerItem key={entry.store.id} className={`nv-rank-pod is-p${i + 1}`}>
                      <Link href={`/s/${entry.store.slug}`} className="nv-rank-pod-link">
                        <span className="nv-rank-pod-medal" aria-label={`Rank ${i + 1}`}>
                          {MEDALS[i]}
                        </span>
                        <RankLogo store={entry.store} theme={entry.theme} size={58} className="nv-rank-pod-logo" />
                        <h3>
                          <span>{entry.store.name}</span>
                          {entry.store.verification_status === 'verified' && <VerifiedTick size={14} />}
                        </h3>
                        <p className="nv-rank-pod-cat">
                          {categoryEmoji(entry.store.category)} {categoryLabel(entry.store.category)}
                        </p>
                        <Stars value={Number(entry.stats.avg_stars)} showNumeric={false} />
                        <p className="nv-rank-pod-meta">
                          <strong>{Number(entry.stats.avg_stars).toFixed(1)}</strong>
                          <span>· {entry.stats.review_count} review{entry.stats.review_count === 1 ? '' : 's'}</span>
                        </p>
                        <span className="nv-rank-pod-cta">
                          Visit store <ArrowRight size={13} />
                        </span>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>

                {/* ------------------------------- LIST ------------------------------- */}
                {rest.length > 0 && (
                  <ol className="nv-rank-list">
                    {rest.map((entry, i) => {
                      const place = i + 4;
                      return (
                        <li key={entry.store.id}>
                          <Link href={`/s/${entry.store.slug}`} className="nv-rank-row">
                            <span className="nv-rank-num">{place}</span>
                            <RankLogo store={entry.store} theme={entry.theme} size={44} />
                            <span className="nv-rank-info">
                              <strong>
                                <span>{entry.store.name}</span>
                                {entry.store.verification_status === 'verified' && <VerifiedTick size={13} />}
                              </strong>
                              <em>
                                {categoryEmoji(entry.store.category)} {categoryLabel(entry.store.category)}
                                {entry.store.is_dropshipper ? ' · 🚚 dropshipper' : ''}
                              </em>
                            </span>
                            <span className="nv-rank-rating">
                              <Stars value={Number(entry.stats.avg_stars)} showNumeric={false} />
                              <em>
                                {Number(entry.stats.avg_stars).toFixed(1)} · {entry.stats.review_count}
                              </em>
                            </span>
                            <span className="nv-rank-score" title="Weighted rank score">
                              {Number(entry.stats.weighted_score).toFixed(2)}
                            </span>
                            <ArrowRight size={15} className="nv-rank-go" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </div>

          {/* ------------------------------- SIDEBAR ------------------------------ */}
          <aside className="nv-rank-side">
            <section className="nv-rank-card">
              <h2>
                <Sparkles size={15} aria-hidden /> How ranking works
              </h2>
              <ul className="nv-rank-rules">
                {RULES.map(({ Icon, title: ruleTitle, text }) => (
                  <li key={ruleTitle}>
                    <span className="nv-rank-rule-ico" aria-hidden>
                      <Icon size={15} />
                    </span>
                    <div>
                      <strong>{ruleTitle}</strong>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/faq" className="nv-rank-card-link">
                Read the ranking FAQ <ArrowRight size={14} />
              </Link>
            </section>

            <section className="nv-rank-card nv-rank-card-accent">
              <span className="nv-rank-card-eyebrow">
                <Star size={13} aria-hidden /> For sellers
              </span>
              <h2>Rankings are earned, not bought.</h2>
              <p>
                Deliver well, keep your hours current and ask buyers to rate the order. The score
                does the rest.
              </p>
              <div className="nv-rank-card-actions">
                <Link href="/dashboard" className="btn btn-primary btn-sm">
                  Open your store
                </Link>
                <Link href="/discover" className="btn btn-outline btn-sm">
                  See the map
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
