// create-order — server validates prices from the DB (never trusts client totals),
// creates order + items, returns the order id for the checkout page.
// Idempotency (backend skill #29): client may send an Idempotency-Key header; a replay
// within 10 minutes returns the original order instead of double-writing.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getCustomerUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { mintPayToken } from '@/lib/paytoken';
import { parseCartLines, sanitizeText, isValidPhone } from '@idevtenancy/shared';
import { isZoneId, zoneLabel, zonesOf } from '@/lib/deliveryZones';
import { ILORIN_AREAS, inIlorin } from '@/lib/ilorin';

// Idempotency cache keyed by CALLER IP + the client-supplied key — the raw key
// alone would let anyone replay another buyer's key and receive their orderId.
// Entries expire after 10 minutes; the map is opportunistically trimmed so it
// can't grow unbounded.
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const IDEMPOTENCY_MAX_ENTRIES = 10_000;
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
  const deliveryMethod = sanitizeText(b.deliveryMethod, 20); // '', pickup, rider, courier or zone
  const deliveryZone = sanitizeText(b.deliveryZone, 40); // landmark id when deliveryMethod = 'zone'
  const paymentMethod = sanitizeText(b.paymentMethod, 24);
  const lines = parseCartLines(b.items);
  // Delivery details (T05/T08). The pin is optional and only sent when the
  // buyer drops one at checkout; it must be inside Ilorin.
  const deliveryArea = sanitizeText(b.deliveryArea, 40);
  const deliveryAddress = sanitizeText(b.deliveryAddress, 200);
  const deliveryLandmark = sanitizeText(b.deliveryLandmark, 120);
  const deliveryNote = sanitizeText(b.note, 300);
  const pinLat = typeof b.dropLat === 'number' && Number.isFinite(b.dropLat) ? b.dropLat : null;
  const pinLng = typeof b.dropLng === 'number' && Number.isFinite(b.dropLng) ? b.dropLng : null;

  if (deliveryMethod && !['pickup', 'rider', 'courier', 'zone'].includes(deliveryMethod)) {
    return apiError(422, 'invalid_delivery', 'Pick a valid delivery option.');
  }
  if (deliveryMethod === 'zone' && !isZoneId(deliveryZone)) {
    return apiError(422, 'invalid_zone', 'Pick a delivery zone.');
  }

  const delivering = deliveryMethod === 'rider' || deliveryMethod === 'courier';
  if (delivering && !ILORIN_AREAS.some((a) => a.id === deliveryArea)) {
    return apiError(422, 'invalid_area', 'Pick your Ilorin area for delivery. Kwaravend only delivers in Ilorin for now.');
  }
  if (delivering && deliveryAddress.length < 4 && deliveryLandmark.length < 4 && pinLat == null) {
    return apiError(422, 'missing_address', 'Tell the rider where to come: an address, a landmark or a pin on the map.');
  }
  if ((pinLat == null) !== (pinLng == null) || (pinLat != null && !inIlorin(pinLat, pinLng!))) {
    return apiError(422, 'invalid_pin', 'The map pin must be inside Ilorin.');
  }

  const PAYMENT_METHODS = ['', 'cash_on_delivery', 'bank_transfer', 'pay_on_pickup', 'other'];
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return apiError(422, 'invalid_payment_method', 'Pick how you will pay.');
  }

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (customerName.length < 2) return apiError(400, 'invalid_name', 'Enter your full name (at least 2 characters).');
  if (!isValidPhone(customerPhone)) return apiError(422, 'invalid_phone', 'Enter a valid phone number in international format, e.g. +2348012345678.');
  if (!lines) return apiError(400, 'invalid_items', 'Your cart is empty or contains invalid items.');

  const idempotencyKey = req.headers.get('idempotency-key');
  const cacheKey = idempotencyKey ? `${clientIp(req)}:${idempotencyKey}` : null;
  if (cacheKey) {
    const cached = idempotencyCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return apiOk({ orderId: cached.orderId });
    if (cached) idempotencyCache.delete(cacheKey); // expired entry
  }

  try {
    const sb = supabaseService();

    const { data: store, error: storeErr } = await sb.from('stores').select('id, delivery_options, is_example').eq('slug', slug).maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');
    // Example stores are sample data: never let a real buyer place an order.
    if (store.is_example) return apiError(403, 'example_store', 'This is an example store with sample data. It cannot take orders.');

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
        .select('code, percent_off, active, usage_count, max_uses, zone_id')
        .eq('store_id', store.id)
        .eq('code', promoInput)
        .maybeSingle();
      const p = promo as { code: string; percent_off: number; active: boolean; usage_count: number; max_uses: number | null; zone_id?: string | null } | null;
      if (!p || !p.active || (p.max_uses != null && p.usage_count >= p.max_uses)) {
        return apiError(422, 'invalid_promo', 'That discount code is not valid for this store.');
      }
      // Zone-limited code (e.g. UNILORIN10): only for delivery to that landmark.
      if (p.zone_id && (deliveryMethod !== 'zone' || deliveryZone !== p.zone_id)) {
        return apiError(422, 'promo_zone', `That code only works for delivery to ${zoneLabel(p.zone_id) || 'its zone'}.`);
      }
      discountKobo = Math.round((grossKobo * p.percent_off) / 100);
      appliedCode = p.code;
    }
    // Delivery: fee comes from the store's own options — never from the client.
    let deliveryFeeKobo = 0;
    if (deliveryMethod === 'zone') {
      const zone = zonesOf(store.delivery_options)[deliveryZone];
      if (!zone?.enabled) {
        return apiError(422, 'invalid_zone', 'This store does not deliver to that zone.');
      }
      deliveryFeeKobo = zone.fee_kobo;
    } else if (deliveryMethod) {
      const opts = store.delivery_options as Record<string, { enabled?: boolean; fee_kobo?: number }> | null;
      const opt = opts?.[deliveryMethod];
      if (!opt?.enabled) {
        return apiError(422, 'invalid_delivery', 'That delivery option is not available for this store.');
      }
      deliveryFeeKobo = Math.max(0, Number(opt.fee_kobo ?? 0));
    }

    const totalKobo = Math.max(0, grossKobo - discountKobo) + deliveryFeeKobo;

    // Attribute the order to the signed-in customer (if any) so it shows in /account.
    const customer = await getCustomerUser();

    // The RPC below writes the order itself. Inserting here first used to create
    // a second, empty order on every successful checkout.
    //
    // Use the atomic order RPC to create order + items + stock decrement + promo increment in one transaction.
    // This prevents half-written state (order without items, stock decremented but no order, promo counted but no order) that
    // the old separate-write approach could leave on failure.
    const listingsJson = JSON.stringify(dbListings.map((l) => l.id));
    const quantitiesJson = JSON.stringify(lines.map((l) => l.quantity));
    const { data: result, error: atomicErr } = await sb.rpc('create_order_atomic', {
      p_store_id: store.id,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_listing_ids: listingsJson,
      p_quantities: quantitiesJson,
      p_discount_code: appliedCode,
      p_delivery_method: deliveryMethod,
      p_total_kobo: totalKobo,
      p_customer_id: customer?.id ?? null,
      p_delivery_fee_kobo: deliveryFeeKobo,
      p_discount_kobo: discountKobo,
    });
    if (atomicErr) throw atomicErr;
    // result contains { order_id, status } from the RPC.
    // The checkout page expects orderId; the returned field is also order_id.
    const atomicOrderId = (result as { order_id: string }).order_id;

    // Record how the buyer intends to pay. Best-effort until the T04 migration
    // (payment_method column) has been applied — a missing column must not cost
    // the buyer their order.
    if (deliveryMethod === 'zone') {
      const { error: zoneErr } = await sb.from('orders').update({ delivery_zone: deliveryZone }).eq('id', atomicOrderId);
      if (zoneErr) console.warn('[create-order] delivery_zone not stored:', zoneErr.message);
    }

    // Where to deliver. Best-effort until the 20261121110000 migration is
    // applied: a missing column must not cost the buyer their order.
    if (deliveryMethod && deliveryMethod !== 'pickup') {
      const { error: dropErr } = await sb
        .from('orders')
        .update({
          delivery_area: delivering ? deliveryArea : '',
          delivery_address: deliveryAddress,
          delivery_landmark: deliveryLandmark,
          drop_lat: pinLat,
          drop_lng: pinLng,
        })
        .eq('id', atomicOrderId);
      if (dropErr) console.warn('[create-order] delivery details not stored:', dropErr.message);
    }
    if (deliveryNote) {
      const { error: noteErr } = await sb.from('orders').update({ delivery_note: deliveryNote }).eq('id', atomicOrderId);
      if (noteErr) console.warn('[create-order] note not stored:', noteErr.message);
    }

    if (paymentMethod) {
      const { error: payMethodErr } = await sb
        .from('orders')
        .update({ payment_method: paymentMethod })
        .eq('id', atomicOrderId);
      if (payMethodErr) console.warn('[create-order] payment_method not stored:', payMethodErr.message);
    }

    if (cacheKey) {
      if (idempotencyCache.size >= IDEMPOTENCY_MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of idempotencyCache) {
          if (v.expires <= now) idempotencyCache.delete(k);
        }
        // Still full? Drop the oldest entries (Map preserves insertion order).
        while (idempotencyCache.size >= IDEMPOTENCY_MAX_ENTRIES) {
          const oldest = idempotencyCache.keys().next().value;
          if (oldest === undefined) break;
          idempotencyCache.delete(oldest);
        }
      }
      idempotencyCache.set(cacheKey, { orderId: atomicOrderId, expires: Date.now() + IDEMPOTENCY_TTL_MS });
    }

    // Mint a single-purpose payment token: mock-pay refuses to mark this order
    // paid without it, so a random orderId is not enough to complete payment.
    const payToken = mintPayToken(atomicOrderId);

    return apiOk({ orderId: atomicOrderId, totalKobo, discountKobo, discountCode: appliedCode, deliveryMethod, deliveryFeeKobo, payToken }, 201);
  } catch (err) {
    return internalError('create-order', err);
  }
}
