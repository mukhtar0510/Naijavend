// Disputes — seller side. The store owner responds to an open report:
//   resolve  → fixed/arranged with the buyer, no money moves
//   refund   → full or partial refund: order flips to 'refunded' (allowed by
//              the guard trigger for paid/fulfilled -> refunded) and the
//              dispute records the amount
//   reject   → reviewed and declined; a note explaining why is REQUIRED
// The buyer gets an alert either way (trg_alert_dispute on the disputes table).
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

const ACTIONS = new Set(['resolve', 'refund', 'reject']);

export async function POST(req: NextRequest) {
  const rl = rateLimit(`dispute-respond:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many updates. Try again in ${rl.retryAfterSeconds}s.`);

  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const disputeId = sanitizeText(b.disputeId, 40);
  const action = sanitizeText(b.action, 20);
  const note = sanitizeText(b.note, 500);

  if (!/^[0-9a-f-]{36}$/i.test(disputeId)) return apiError(400, 'invalid_dispute', 'Invalid report.');
  if (!ACTIONS.has(action)) return apiError(422, 'invalid_action', 'Unknown response.');
  if (action === 'reject' && note.length < 10) {
    return apiError(422, 'note_required', 'Explain why you are declining (at least 10 characters) — the buyer sees it.');
  }

  try {
    // RLS (disputes seller read) scopes this to disputes on the seller's own store.
    const { data: dispute, error } = await sb
      .from('disputes')
      .select('id, order_id, store_id, status, refund_kobo')
      .eq('id', disputeId)
      .maybeSingle();
    if (error) throw error;
    if (!dispute) return apiError(404, 'not_found', 'Report not found (or not on your store).');
    if (dispute.status !== 'open') {
      return apiError(409, 'already_closed', 'This report has already been closed.');
    }

    if (action === 'refund') {
      const { data: order, error: orderErr } = await sb
        .from('orders')
        .select('id, status, total_kobo, discount_kobo')
        .eq('id', dispute.order_id)
        .maybeSingle();
      if (orderErr) throw orderErr;
      if (!order) return apiError(404, 'order_not_found', 'Order not found.');
      if (order.status !== 'paid' && order.status !== 'fulfilled') {
        return apiError(409, 'not_refundable', `A ${order.status} order cannot be refunded.`);
      }

      // Full refund of what the buyer actually paid (total already has discount applied).
      const refundKobo = Math.max(0, Number(order.total_kobo));
      const { error: refundErr } = await sb
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', order.id)
        .eq('status', order.status); // race guard: only from the state we validated
      if (refundErr) {
        // The guard trigger is the authority — surface its rejection cleanly.
        return apiError(409, 'refund_rejected', 'The system rejected this refund — the order may have changed state.');
      }

      const { error: closeErr } = await sb
        .from('disputes')
        .update({ status: 'refunded', seller_note: note, refund_kobo: refundKobo })
        .eq('id', dispute.id)
        .eq('status', 'open');
      if (closeErr) throw closeErr;
      return apiOk({ updated: true, status: 'refunded', refundKobo });
    }

    const next = action === 'resolve' ? 'resolved' : 'rejected';
    const { error: updErr } = await sb
      .from('disputes')
      .update({ status: next, seller_note: note })
      .eq('id', dispute.id)
      .eq('status', 'open');
    if (updErr) throw updErr;
    return apiOk({ updated: true, status: next });
  } catch (err) {
    return internalError('disputes/respond', err);
  }
}
