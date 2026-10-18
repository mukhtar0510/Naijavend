// Moderation flag queue: the one reader of `moderation_flags`. The storefront's
// content paths (chat, reviews, listings, stores) write flags through the
// service role and RLS blocks everyone else, so this route is the triage
// surface. Admin-gated, service-role, audit-logged.
//
// Nothing is ever deleted here — a flag only moves between statuses:
// open → reviewed (a human looked and agreed) or dismissed (a false positive),
// with `reopen` to send it back to the queue.
import { NextRequest } from 'next/server';
import { requireAdminActor, audit } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

const STATUSES = ['open', 'reviewed', 'dismissed'] as const;
const KINDS = new Set(['chat', 'review', 'listing', 'store']);
// The three UI verbs, mapped onto the two stored states.
const ACTION_TO_STATUS: Record<string, string> = {
  reviewed: 'reviewed',
  dismissed: 'dismissed',
  reopen: 'open',
};

type JoinedRow = Record<string, unknown> & { stores?: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null };

function flatten(row: JoinedRow) {
  const { stores, ...rest } = row;
  const s = Array.isArray(stores) ? stores[0] : stores;
  return {
    ...rest,
    store_name: s?.name ?? null,
    store_slug: s?.slug ?? null,
    // jsonb arrives as unknown — normalise the shape the UI can rely on.
    labels: Array.isArray(row.labels) ? (row.labels as string[]).filter((l) => typeof l === 'string') : [],
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);

  const params = req.nextUrl.searchParams;
  const status = params.get('status') ?? 'open';
  const kind = params.get('kind') ?? '';
  const limit = Math.min(Math.max(Number(params.get('limit')) || 100, 1), 300);

  if (status !== 'all' && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return apiError(400, 'bad_status', 'status must be open, reviewed, dismissed or all.');
  }
  if (kind && !KINDS.has(kind)) return apiError(400, 'bad_kind', 'kind must be chat, review, listing or store.');

  let query = actor.svc
    .from('moderation_flags')
    .select('id, store_id, kind, ref_id, labels, excerpt, source, status, created_at, stores(name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status !== 'all') query = query.eq('status', status);
  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error) return apiError(500, 'query_failed', error.message);

  // Tab badges need all three totals regardless of the active filter — head
  // counts, so only counters come back from Postgres.
  const [open, reviewed, dismissed] = await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await actor.svc
        .from('moderation_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', s);
      return count ?? 0;
    }),
  );

  return apiOk({
    flags: (data ?? []).map((r) => flatten(r as JoinedRow)),
    counts: { open, reviewed, dismissed },
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const { svc, email: actorEmail } = actor;

  let action = '';
  let id = '';
  let reason = '';
  try {
    const body = await req.json();
    action = typeof body.action === 'string' ? body.action : '';
    id = typeof body.id === 'string' ? body.id : '';
    reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : '';
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) return apiError(400, 'bad_action', 'action must be reviewed, dismissed or reopen.');
  if (!id) return apiError(400, 'missing_id', 'Flag id is required.');

  const { data: existing } = await svc
    .from('moderation_flags')
    .select('id, kind, labels, store_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return apiError(404, 'not_found', 'Flag not found.');

  const { error } = await svc.from('moderation_flags').update({ status: nextStatus }).eq('id', id);
  if (error) return apiError(500, 'update_failed', error.message);

  await audit(actorEmail, `flag_${action}`, { userId: id }, {
    kind: existing.kind,
    labels: existing.labels,
    store: existing.store_id,
    from: existing.status,
    to: nextStatus,
    reason,
  });
  return apiOk({ ok: true, action, id, status: nextStatus });
}