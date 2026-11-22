// Moderation (BUILD.md T13): store reports queue and blue-tick revoke/grant.
//   GET                         open + reviewing reports, newest first
//   POST { reportId, status }   reviewing | closed
//   POST { storeId, verified }  grant or revoke the blue tick
// Every write is recorded in the admin audit log.
import { NextRequest } from 'next/server';
import { audit, requireAdminActor } from '@/lib/admin';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET() {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  try {
    const { data, error } = await actor.svc
      .from('store_reports')
      .select('id, reason, message, status, created_at, stores(id, name, slug, verification_status)')
      .in('status', ['open', 'reviewing'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return apiOk({ reports: data ?? [] });
  } catch (err) {
    return internalError('admin-moderation', err);
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const reportId = sanitizeText(b.reportId, 40);
    if (reportId) {
      const status = sanitizeText(b.status, 12);
      if (!UUID.test(reportId) || !['reviewing', 'closed'].includes(status)) return apiError(422, 'invalid', 'Invalid report or status.');
      const { error } = await actor.svc.from('store_reports').update({ status }).eq('id', reportId);
      if (error) throw error;
      await audit(actor.email, `report_${status}`, undefined, { reportId });
      return apiOk({ updated: true });
    }
    const storeId = sanitizeText(b.storeId, 40);
    if (UUID.test(storeId) && typeof b.verified === 'boolean') {
      const { error } = await actor.svc
        .from('stores')
        .update({ verification_status: b.verified ? 'verified' : 'unverified', verified_at: b.verified ? new Date().toISOString() : null })
        .eq('id', storeId);
      if (error) throw error;
      await audit(actor.email, b.verified ? 'blue_tick_granted' : 'blue_tick_revoked', undefined, { storeId, note: sanitizeText(b.note, 200) });
      return apiOk({ updated: true });
    }
    return apiError(422, 'invalid', 'Nothing to do.');
  } catch (err) {
    return internalError('admin-moderation', err);
  }
}
