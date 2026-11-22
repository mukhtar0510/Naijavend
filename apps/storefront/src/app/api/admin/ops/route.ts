// Owner operations for the plan features (23 Nov 2026): Kwaravend rider
// requests, support tickets and custom domains. Every write is audit-logged.
//   GET ?area=riders|support|domains
//   POST { area: 'riders', id, status, riderName?, riderPhone?, adminNote? }
//   POST { area: 'support', id, reply?, status? }
//   POST { area: 'domains', id, status, note? }
import { NextRequest } from 'next/server';
import { audit, requireAdminActor } from '@/lib/admin';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { sanitizeMultiline } from '@/lib/text';

const UUID = /^[0-9a-f-]{36}$/i;
const RIDER_STATUS = ['requested', 'assigned', 'picked_up', 'delivered', 'cancelled'];

export async function GET(req: NextRequest) {
  const actor = await requireAdminActor();
  if ('error' in actor) return apiError(actor.status, 'forbidden', actor.error);
  const area = new URL(req.url).searchParams.get('area');
  const { svc } = actor;
  try {
    if (area === 'riders') {
      const { data, error } = await svc
        .from('rider_requests')
        .select('id, speed, pickup, dropoff, note, status, rider_name, rider_phone, admin_note, created_at, stores(name, slug, whatsapp_number)')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return apiOk({ rows: data ?? [] });
    }
    if (area === 'support') {
      const { data, error } = await svc
        .from('support_tickets')
        .select('id, subject, message, priority, status, reply, replied_at, created_at, stores(name, slug)')
        .order('status', { ascending: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(150);
      if (error) throw error;
      return apiOk({ rows: data ?? [] });
    }
    if (area === 'domains') {
      const { data, error } = await svc.from('store_domains').select('id, domain, status, note, created_at, activated_at, stores(name, slug)').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return apiOk({ rows: data ?? [] });
    }
    return apiError(400, 'invalid_area', 'Unknown area.');
  } catch (err) {
    return internalError('admin-ops', err);
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
  const id = sanitizeText(b.id, 40);
  if (!UUID.test(id)) return apiError(400, 'invalid', 'Invalid id.');
  const { svc } = actor;
  const now = new Date().toISOString();
  try {
    if (b.area === 'riders') {
      const status = sanitizeText(b.status, 12);
      if (!RIDER_STATUS.includes(status)) return apiError(422, 'invalid_status', 'Unknown status.');
      const riderName = sanitizeText(b.riderName, 80);
      const riderPhone = sanitizeText(b.riderPhone, 20).replace(/[^\d+]/g, '');
      if (status === 'assigned' && (riderName.length < 2 || riderPhone.length < 7)) return apiError(422, 'rider_required', 'Add the rider’s name and phone.');
      const patch: Record<string, unknown> = { status, updated_at: now, admin_note: sanitizeText(b.adminNote, 300) };
      if (riderName) patch.rider_name = riderName;
      if (riderPhone) patch.rider_phone = riderPhone;
      const { error } = await svc.from('rider_requests').update(patch).eq('id', id);
      if (error) throw error;
      await audit(actor.email, 'rider_request_updated', undefined, { id, status });
      return apiOk({ updated: true });
    }
    if (b.area === 'support') {
      const reply = sanitizeMultiline(b.reply, 2000);
      const status = b.status === 'closed' ? 'closed' : reply ? 'answered' : null;
      if (!status) return apiError(422, 'empty_reply', 'Write a reply first.');
      const patch: Record<string, unknown> = { status };
      if (reply) Object.assign(patch, { reply, replied_by: actor.email, replied_at: now });
      const { error } = await svc.from('support_tickets').update(patch).eq('id', id);
      if (error) throw error;
      await audit(actor.email, 'support_ticket_updated', undefined, { id, status });
      return apiOk({ updated: true });
    }
    if (b.area === 'domains') {
      const status = sanitizeText(b.status, 10);
      if (!['pending', 'active', 'failed'].includes(status)) return apiError(422, 'invalid_status', 'Unknown status.');
      const { error } = await svc
        .from('store_domains')
        .update({ status, note: sanitizeText(b.note, 300), activated_at: status === 'active' ? now : null })
        .eq('id', id);
      if (error) throw error;
      await audit(actor.email, 'store_domain_updated', undefined, { id, status });
      return apiOk({ updated: true });
    }
    return apiError(400, 'invalid_area', 'Unknown area.');
  } catch (err) {
    return internalError('admin-ops', err);
  }
}
