// Rider link actions (T09). Riders have no accounts: the seller sends them a
// private link per delivery. The token is the only credential, rotated
// whenever the rider changes. Riders can move the delivery forward, report a
// failed attempt, and finish ONLY with the buyer's 4-digit code.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { applyStatus, isStatus, type DeliveryStatus } from '@/lib/delivery';

const RIDER_MOVES: DeliveryStatus[] = ['picked_up', 'in_transit', 'arrived', 'delivered', 'failed_attempt'];

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const rl = rateLimit(`rider:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many tries. Wait a minute.');
  const token = sanitizeText(params.token, 64);
  if (token.length < 20) return apiError(404, 'not_found', 'This link is not valid.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const next = sanitizeText(b.next, 24);
  if (!isStatus(next) || !RIDER_MOVES.includes(next)) return apiError(422, 'invalid_status', 'Not allowed from the rider link.');
  try {
    const svc = supabaseService();
    const { data: d } = await svc.from('deliveries').select('id, status, order_id, rider_id').eq('rider_token', token).maybeSingle();
    if (!d) return apiError(404, 'not_found', 'This link is no longer valid. Ask the seller for a new one.');
    const r = await applyStatus(svc, d as { id: string; status: DeliveryStatus; order_id: string; rider_id: string | null }, next, {
      actor: 'rider',
      otp: sanitizeText(b.otp, 8),
      reason: sanitizeText(b.reason, 160),
      note: sanitizeText(b.note, 200),
    });
    if (!r.ok) return apiError(409, r.code, r.message);
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('rider-link', err);
  }
}
