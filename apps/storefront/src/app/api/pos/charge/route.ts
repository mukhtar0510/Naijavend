// pos/charge — records an in-person sale made at the POS terminal.
// Free for every seller; the acting user must be the store owner
// or an active staff member of that store. Prices are re-read from the DB —
// the client total is never trusted. Orders are created as 'paid' with
// channel='pos' so analytics and stock stay in one source of truth.

import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { parseCartLines, sanitizeText } from '@idevtenancy/shared';
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
    // Everything runs under the actor's own identity — RLS policies
    // (orders_pos_insert, order_items_pos_insert, listings_pos_staff) enforce
    // the same owner-or-active-staff rule at the database layer.
    const sb = sellerSb;

    // Server-side price check, same discipline as online orders.
    const listingIds = lines.map((l) => l.listingId);
    const { data: dbListings, error: listingErr } = await sb
      .from('listings')
      .select('id, price_kobo, type, stock, title')
      .in('id', listingIds)
      .eq('store_id', ctx.storeId);
    if (listingErr) throw listingErr;
    if (!dbListings || dbListings.length !== listingIds.length) {
      return apiError(422, 'unknown_listing', 'One or more items are no longer available.');
    }
    if (dbListings.some((l) => l.type !== 'product')) {
      return apiError(422, 'not_orderable', 'Services are booked, not sold on the POS.');
    }
    for (const l of dbListings) {
      if (l.stock === 0) return apiError(422, 'sold_out', `"${l.title}" is sold out.`);
      if (l.stock != null) {
        const wanted = lines.filter((ln) => ln.listingId === l.id).reduce((s, ln) => s + ln.quantity, 0);
        if (wanted > l.stock) {
          return apiError(422, 'insufficient_stock', `Only ${l.stock} of "${l.title}" left in stock.`);
        }
      }
    }

    const priceById = new Map(dbListings.map((l) => [l.id, l.price_kobo as number]));
    const totalKobo = lines.reduce((sum, l) => sum + priceById.get(l.listingId)! * l.quantity, 0);

    // Use the atomic order RPC to create order + items + stock decrement + promo increment in one transaction.
    // This prevents half-written state that the old separate-write approach could leave on failure.
    const listingsJson = JSON.stringify(dbListings.map((l) => l.id));
    const quantitiesJson = JSON.stringify(lines.map((l) => l.quantity));
    const { data: result, error: atomicErr } = await sb.rpc('create_order_atomic', {
      p_store_id: ctx.storeId,
      p_customer_name: 'Walk-in customer',
      p_customer_phone: '0000000000',
      p_listing_ids: listingsJson,
      p_quantities: quantitiesJson,
      p_discount_code: null,
      p_delivery_method: 'cash',
      p_total_kobo: totalKobo,
    });
    if (atomicErr) throw atomicErr;
    // result contains { order_id, status } from the RPC.
    const atomicOrderId = (result as { order_id: string }).order_id;

    return apiOk({ orderId: atomicOrderId, totalKobo }, 201);
  } catch (err) {
    return internalError('pos/charge', err);
  }
}
