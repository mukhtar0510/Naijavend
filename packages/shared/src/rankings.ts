// Ranking math — mirrors supabase/migrations/20260911000003_rankings.sql.
// Single source of truth for the formula lives in SQL; this module exists for
// unit testing the math and for client-side display helpers.

export const BAYES_PRIOR_WEIGHT = 5;
export const BAYES_PRIOR_MEAN = 3.5;

/** Bayesian average: a 1-review 5★ store can't outrank a 200-review 4.8★ store. */
export function weightedScore(reviewCount: number, sumStars: number): number {
  if (reviewCount <= 0) return 0;
  return Number(
    (((BAYES_PRIOR_WEIGHT * BAYES_PRIOR_MEAN) + sumStars) / (BAYES_PRIOR_WEIGHT + reviewCount)).toFixed(3)
  );
}

export type RankDirection = 'up' | 'down' | 'same' | 'new';

export function rankDirection(previous: number | null | undefined, current: number): RankDirection {
  if (previous == null) return 'new';
  if (current < previous) return 'up';
  if (current > previous) return 'down';
  return 'same';
}

/** Star display with a single decimal, e.g. "4.8". */
export function formatAvgStars(avg: number): string {
  return avg.toFixed(1);
}
