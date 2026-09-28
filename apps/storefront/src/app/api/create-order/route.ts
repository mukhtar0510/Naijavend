// create-order — server validates prices from the DB (never trusts client totals),
// creates order + items, returns the order id for the checkout page.
// Idempotency (backend skill #29): client may send an Idempotency-Key header; a replay
// within 10 minutes returns the original order instead of double-writing.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getCustomerUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { parseCartLines, sanitizeText, isValidPhone } from '@idevtenancy/shared';

const idempotencyCache = new Map<string, { orderId: string; expires: number }>();

export async function POST(req: NextRequest) {
  const rl = rateLimit(`create-order:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many orders from this connection. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const customerName = sanitizeText(b.customerName, 120);
  const customerPhone = sanitizeText(b.customerPhone, 16);
  const promoInput = sanitizeText(b.promoCode, 40).toUpperCase();
  const lines = parseCartLines(b.items);

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (customerName.length < 2) return apiError(400, 'invalid_name', 'Enter your full name (at least 2 characters).');
  if (!isValidPhone(customerPhone)) return apiError(422, 'invalid_phone', 'Enter a valid phone number in international format, e.g. +2348012345678.');
  if (!lines) return apiError(400, 'invalid_items', 'Your cart is empty or contains invalid items.');

  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && cached.expires > Date.now()) return apiOk({ orderId: cached.orderId });
  }

  try {
    const sb = supabaseService();

    const { data: store, error: storeErr } = await sb.from('stores').select('id').eq('slug', slug).maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');

    // Price validation happens here, server-side.
    const listingIds = lines.map((l) => l.listingId);
    const { data: dbListings, error: listingErr } = await sb
      .from('listings')
      .select('id, price_kobo, type, stock, title')
      .in('id', listingIds)
      .eq('store_id', store.id);
    if (listingErr) throw listingErr;
    if (!dbListings || dbListings.length !== listingIds.length) {
      return apiError(422, 'unknown_listing', 'One or more items are no longer available.');
    }
    if (dbListings.some((l) => l.type !== 'product')) {
      return apiError(422, 'not_orderable', 'Services are booked, not ordered. Use the booking flow.');
    }
    // Stock guard: block sold-out lines entirely and over-ordering beyond stock.
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
    const grossKobo = lines.reduce((sum, l) => sum + priceById.get(l.listingId)! * l.quantity, 0);

    // Discount code (Shopify-style promo): validated server-side, per store, active only.
    let discountKobo = 0;
    let appliedCode: string | null = null;
    if (promoInput) {
      const { data: promo } = await sb
        .from('discount_codes')
        .select('code, percent_off, active, usage_count, max_uses')
        .eq('store_id', store.id)
        .eq('code', promoInput)
        .maybeSingle();
      const p = promo as { code: string; percent_off: number; active: boolean; usage_count: number; max_uses: number | null } | null;
      if (!p || !p.active || (p.max_uses != null && p.usage_count >= p.max_uses)) {
        return apiError(422, 'invalid_promo', 'That discount code is not valid for this store.');
      }
      discountKobo = Math.round((grossKobo * p.percent_off) / 100);
      appliedCode = p.code;
    }
    const totalKobo = Math.max(0, grossKobo - discountKobo);

    // Attribute the order to the signed-in customer (if any) so it shows in /account.
    const customer = await getCustomerUser();

    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({ store_id: store.id, customer_id: customer?.id ?? null, customer_name: customerName, customer_phone: customerPhone, total_kobo: totalKobo, discount_code: appliedCode, discount_kobo: discountKobo, status: 'pending' })
      .select('id')
      .single();
    if (orderErr) throw orderErr;

    // Decrement stock for tracked products, and count promo usage.
    for (const l of dbListings) {
      if (l.stock != null) {
        const wanted = lines.filter((ln) => ln.listingId === l.id).reduce((s, ln) => s + ln.quantity, 0);
        await sb.from('listings').update({ stock: Math.max(0, (l.stock as number) - wanted) }).eq('id', l.id);
      }
    }
    if (appliedCode) {
      // Count promo usage (read-modify-write; single-store promos are low-contention).
      const { data: row } = await sb.from('discount_codes').select('usage_count').eq('store_id', store.id).eq('code', appliedCode).maybeSingle();
      await sb.from('discount_codes').update({ usage_count: ((row?.usage_count as number | undefined) ?? 0) + 1 }).eq('store_id', store.id).eq('code', appliedCode);
    }

    const { error: itemsErr } = await sb.from('order_items').insert(
      lines.map((l) => ({ order_id: order.id, listing_id: l.listingId, quantity: l.quantity, unit_price_kobo: priceById.get(l.listingId)! }))
    );
    if (itemsErr) throw itemsErr;

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { orderId: order.id, expires: Date.now() + 10 * 60_000 });
    }

    return apiOk({ orderId: order.id, totalKobo, discountKobo, discountCode: appliedCode }, 201);
  } catch (err) {
    return internalError('create-order', err);
  }
}
