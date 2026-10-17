// Weekly seller insight (GET) — computes this week vs last week server-side,
// then lets the model turn those numbers into plain language. The analytics
// page fetches this in the background so a slow model never blocks the charts;
// `numbers` comes back regardless, so the card still says something useful
// when there is no model key at all.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { aiComplete } from '@idevtenancy/ai';
import { insightInput, weeklyNumbers, type InsightNumbers } from '@/lib/insights';

export interface InsightsPayload {
  numbers: InsightNumbers | null;
  summary: string | null;
  points: string[];
  action: string | null;
  source: 'model' | 'numbers' | 'none';
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(`insights:${clientIp(req)}`, 12, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Give it ${rl.retryAfterSeconds}s — the widget is rate-limited.`);
  }

  try {
    const sb = await getSellerClient();
    if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

    const store = await getOwnStore<{ id: string; name: string }>(sb, 'id, name');
    if (!store) return apiOk<InsightsPayload>({ numbers: null, summary: null, points: [], action: null, source: 'none' });

    const numbers = await weeklyNumbers(sb, store.id);
    const quiet =
      numbers.thisWeek.views === 0 &&
      numbers.lastWeek.views === 0 &&
      numbers.thisWeek.orders === 0 &&
      numbers.lastWeek.orders === 0;
    if (quiet) return apiOk<InsightsPayload>({ numbers, summary: null, points: [], action: null, source: 'none' });

    try {
      const startedAt = Date.now();
      const result = await aiComplete({ feature: 'weekly_insight', input: insightInput(numbers, store.name) });
      const draft = result.draft as { summary?: unknown; points?: unknown; action?: unknown };
      const summary = typeof draft.summary === 'string' ? draft.summary : null;
      const action = typeof draft.action === 'string' ? draft.action : null;
      const points = Array.isArray(draft.points)
        ? draft.points.filter((p): p is string => typeof p === 'string').slice(0, 3)
        : [];

      const { data: userData } = await sb.auth.getUser();
      await sb.from('ai_usage_log').insert({
        store_id: store.id,
        feature: 'weekly_insight',
        input: insightInput(numbers, store.name),
        tokens_used: result.tokensUsed,
        provider: result.provider,
        user_id: userData.user?.id ?? null,
        latency_ms: Date.now() - startedAt,
      });

      if (summary) return apiOk<InsightsPayload>({ numbers, summary, points, action, source: 'model' });
    } catch (err) {
      // Model failure must not take the dashboard with it — fall through to
      // the raw numbers, which are already computed.
      console.warn('[insights] model wording unavailable:', err);
    }

    return apiOk<InsightsPayload>({ numbers, summary: null, points: [], action: null, source: 'numbers' });
  } catch (err) {
    return internalError('ai-insights', err);
  }
}