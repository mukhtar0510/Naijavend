// Seller support tickets (23 Nov 2026). Every plan can write to Kwaravend;
// Emirates Plus tickets are marked priority and answered first in /admin.
//   POST { subject, message }              open a ticket
//   POST { action: 'close', id }           close your ticket
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { hasFeature } from '@/lib/plans';
import { PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';
import { sanitizeMultiline } from '@/lib/text';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`support:${clientIp(req)}`, 5, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many messages. Wait a minute.');
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
    if (!store) return apiError(403, 'no_store', 'Only the store owner can do this.');
    const svc = supabaseService();

    if (b.action === 'close') {
      const id = sanitizeText(b.id, 40);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid', 'Invalid ticket.');
      const { error } = await svc.from('support_tickets').update({ status: 'closed' }).eq('id', id).eq('store_id', store.id);
      if (error) throw error;
      return apiOk({ closed: true });
    }

    const subject = sanitizeText(b.subject, 120);
    const message = sanitizeMultiline(b.message, 2000);
    if (subject.length < 3) return apiError(422, 'invalid_subject', 'Add a short subject.');
    if (message.length < 5) return apiError(422, 'invalid_message', 'Tell us what you need.');
    const { count } = await svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'open');
    if ((count ?? 0) >= 5) return apiError(429, 'too_many_open', 'You have 5 open tickets. We’ll answer those first.');
    // Priority is decided by the plan itself, whatever the gating flag says.
    const priority = hasFeature(store, 'priority_support', true);
    const { data, error } = await svc.from('support_tickets').insert({ store_id: store.id, subject, message, priority }).select('id, priority').single();
    if (error) throw error;
    return apiOk({ ticket: data }, 201);
  } catch (err) {
    return internalError('support', err);
  }
}
