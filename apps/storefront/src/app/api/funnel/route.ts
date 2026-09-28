// Funnel event sink — authenticated seller logs onboarding behaviour
// (step views, completions, quick-add chip usage, abandon). Fire-and-forget
// from the client; this endpoint is intentionally tiny and never blocks UX.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const EVENTS = new Set(['step_view', 'step_complete', 'chip_add', 'preview_shown', 'abandon']);

export async function POST(req: NextRequest) {
  const rl = rateLimit(`funnel:${clientIp(req)}`, 120, 60_000);
  if (!rl.allowed) return apiOk({ ok: true }); // silently drop excess — never surface 429 to the UI

  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;

  const event = typeof b.event === 'string' ? b.event : '';
  if (!EVENTS.has(event)) return apiError(422, 'bad_event', 'Unknown funnel event.');

  const stepRaw = b.step;
  const step = typeof stepRaw === 'number' && Number.isInteger(stepRaw) && stepRaw >= 1 && stepRaw <= 3 ? stepRaw : null;
  const label = typeof b.label === 'string' ? b.label.slice(0, 120) : null;

  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    // RLS also scopes the insert to auth.uid() — belt and suspenders.
    const { error } = await sb.from('onboarding_funnel_events').insert({ user_id: userId, event, step, label });
    if (error) throw error;
    return apiOk({ ok: true });
  } catch {
    // Never let analytics errors escape — respond ok so the client gives up quietly.
    return apiOk({ ok: true });
  }
}
