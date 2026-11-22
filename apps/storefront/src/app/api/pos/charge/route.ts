// pos/charge — records an in-person sale made at the POS terminal.
// Free for every seller; the acting user must be the store owner
// or an active staff member of that store. create_pos_order prices the sale
// from the DB and records it as paid with channel 'pos' (money changes hands
// at the counter), so analytics and stock stay in one source of truth.

import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { parseCartLines, sanitizeText, mapOrderError, toOrderItems } from '@idevtenancy/shared';
import { getStaffContext } from '@/lib/staff';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`pos-charge:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many charges. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const method = sanitizeText(b.method, 12);
  const lines = parseCartLines(b.items);

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (!['cash', 'transfer', 'card'].includes(method)) {
    return apiError(422, 'invalid_method', 'Payment method must be cash, transfer or card.');
  }
  if (!lines) return apiError(400, 'invalid_items', 'The ticket is empty or has invalid items.');

  // Who is charging? Owner or active staff of this store — never anyone else.
  const sellerSb = await getSellerClient();
  if (!sellerSb) return apiError(401, 'unauthenticated', 'Sign in to use the POS.');
  const ctx = await getStaffContext(sellerSb, slug);
  if (!ctx) return apiError(403, 'not_authorised', 'Only the store owner or active staff can use the POS.');

  try {
    // create_pos_order runs the owner-or-active-staff check again in the
    // database, prices every line from listings and decrements stock in one
    // transaction. The client total is never sent.
    const { data, error } = await sellerSb.rpc('create_pos_order', {
      p_store_id: ctx.storeId,
      p_items: toOrderItems(lines),
      p_method: method,
    });
    if (error) {
      const mapped = mapOrderError(error.message);
      if (!mapped) throw error;
      return apiError(mapped.status, mapped.code, mapped.code === 'not_orderable' ? 'Services are booked, not sold on the POS.' : mapped.message);
    }
    const result = data as { order_id: string; order_code: string; total_kobo: number };
    return apiOk({ orderId: result.order_id, orderCode: result.order_code, totalKobo: result.total_kobo }, 201);
  } catch (err) {
    return internalError('pos/charge', err);
  }
}
