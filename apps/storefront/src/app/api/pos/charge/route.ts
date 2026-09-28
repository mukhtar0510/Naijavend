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

    // Paid immediately: in-person money already changed hands.
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        store_id: ctx.storeId,
        customer_id: null,
        customer_name: 'Walk-in customer',
        customer_phone: '0000000000', // placeholder: POS sales have no buyer phone (DB check needs digits)
        total_kobo: totalKobo,
        status: 'paid',
        channel: 'pos',
        pos_staff_id: ctx.staffId,
      })
      .select('id')
      .single();
    if (orderErr) throw orderErr;

    const { error: itemsErr } = await sb.from('order_items').insert(
      lines.map((l) => ({ order_id: order.id, listing_id: l.listingId, quantity: l.quantity, unit_price_kobo: priceById.get(l.listingId)! }))
    );
    if (itemsErr) throw itemsErr;

    // Stock stays truthful across online + in-person sales.
    for (const l of dbListings) {
      if (l.stock != null) {
        const wanted = lines.filter((ln) => ln.listingId === l.id).reduce((s, ln) => s + ln.quantity, 0);
        await sb.from('listings').update({ stock: Math.max(0, (l.stock as number) - wanted) }).eq('id', l.id);
      }
    }

    return apiOk({ orderId: order.id, totalKobo }, 201);
  } catch (err) {
    return internalError('pos/charge', err);
  }
}
