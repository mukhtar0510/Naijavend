// create-order: checks the request shape, then hands ids, quantities, the
// delivery choice and the discount code to create_order_v2. The database works
// out every amount (INFRASTRUCTURE.md I1); this route only displays it.
// Idempotency: the browser sends a UUID made when checkout opens; the database
// returns the same order for the same key.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getCustomerUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { mintPayToken } from '@/lib/paytoken';
import { parseCartLines, sanitizeText, isValidPhone, normaliseNgPhone, isUuid, mapOrderError, toOrderItems } from '@idevtenancy/shared';
import { isZoneId, zoneLabel } from '@/lib/deliveryZones';
import { ILORIN_AREAS, inIlorin } from '@/lib/ilorin';
import { ensureDelivery } from '@/lib/delivery';
import { recordEvent } from '@/lib/events';

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
  // "0801 234 5678" and "+234 801 ..." are how buyers type; accept them.
  const customerPhone = normaliseNgPhone(sanitizeText(b.customerPhone, 24));
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

  const PAYMENT_METHODS = ['', 'cash_on_delivery', 'bank_transfer', 'pay_on_pickup'];
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return apiError(422, 'invalid_payment_method', 'Pick how you will pay.');
  }

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (customerName.length < 2) return apiError(400, 'invalid_name', 'Enter your full name (at least 2 characters).');
  if (!isValidPhone(customerPhone)) return apiError(422, 'invalid_phone', 'Enter a valid phone number in international format, e.g. +2348012345678.');
  if (!lines) return apiError(400, 'invalid_items', 'Your cart is empty or contains invalid items.');

  // A UUID made when the buyer opens checkout. The database returns the same
  // order for the same key, so a double tap or a retry never makes two orders.
  // Anything that is not a UUID (an old cached page) is ignored.
  const rawKey = req.headers.get('idempotency-key');
  const idempotencyKey = isUuid(rawKey) ? rawKey : null;

  try {
    const sb = supabaseService();

    const { data: store, error: storeErr } = await sb.from('stores').select('id').eq('slug', slug).maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');

    // Attribute the order to the signed-in customer (verified here, on the server).
    const customer = await getCustomerUser();

    // The database prices everything: items from listings, the fee from the
    // store's delivery settings, the discount from the code. Nothing the
    // browser says about money is sent.
    const { data: rpc, error: rpcErr } = await sb.rpc('create_order_v2', {
      p_store_id: store.id,
      p_items: toOrderItems(lines),
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_delivery_method: deliveryMethod,
      p_delivery_zone: deliveryMethod === 'zone' ? deliveryZone : '',
      p_discount_code: promoInput || null,
      p_payment_method: paymentMethod,
      p_idempotency_key: idempotencyKey,
      p_delivery_area: delivering ? deliveryArea : '',
      p_delivery_address: deliveryAddress,
      p_delivery_landmark: deliveryLandmark,
      p_delivery_note: deliveryNote,
      p_drop_lat: delivering ? pinLat : null,
      p_drop_lng: delivering ? pinLng : null,
      p_customer_id: customer?.id ?? null,
      p_client_ip: clientIp(req),
    });
    if (rpcErr) {
      const mapped = mapOrderError(rpcErr.message);
      if (!mapped) throw rpcErr;
      if (mapped.code === 'insufficient_stock' && mapped.listingId) {
        const { data: l } = await sb.from('listings').select('title, stock').eq('id', mapped.listingId).maybeSingle();
        if (l) {
          return apiError(422, 'insufficient_stock', l.stock ? `Only ${l.stock} of "${l.title}" left in stock.` : `"${l.title}" is sold out.`);
        }
      }
      if (mapped.code === 'promo_zone' && mapped.detail) {
        return apiError(422, 'promo_zone', `That code only works for delivery to ${zoneLabel(mapped.detail) || 'its zone'}.`);
      }
      if (mapped.code === 'promo_min_order' && mapped.detail) {
        const min = Math.round(Number(mapped.detail) / 100).toLocaleString('en-NG');
        return apiError(422, 'promo_min_order', `That code needs an order of at least ₦${min} before delivery.`);
      }
      return apiError(mapped.status, mapped.code, mapped.message);
    }

    const result = rpc as {
      order_id: string;
      order_code: string;
      subtotal_kobo: number;
      discount_kobo: number;
      discount_code: string | null;
      delivery_fee_kobo: number;
      total_kobo: number;
      replayed: boolean;
    };
    const atomicOrderId = result.order_id;

    if (result.replayed) {
      // Same checkout sent twice: hand back the order it already made.
      const { data: delivery } = await sb.from('deliveries').select('tracking_token').eq('order_id', atomicOrderId).maybeSingle();
      return apiOk({
        orderId: atomicOrderId,
        orderCode: result.order_code,
        subtotalKobo: result.subtotal_kobo,
        totalKobo: result.total_kobo,
        discountKobo: result.discount_kobo,
        discountCode: result.discount_code,
        deliveryMethod,
        deliveryFeeKobo: result.delivery_fee_kobo,
        payToken: mintPayToken(atomicOrderId),
        trackingToken: delivery?.tracking_token ?? null,
        replayed: true,
      });
    }

    await recordEvent('order_created', store.id, sb);

    // Delivery tracking (T09): rider, courier and campus orders get a delivery
    // straight away so the buyer's confirmation page has a tracking link.
    // Best-effort: a missing table must never cost the buyer their order.
    let trackingToken: string | null = null;
    if (delivering || deliveryMethod === 'zone') {
      try {
        trackingToken = (await ensureDelivery(sb, { id: atomicOrderId, store_id: store.id }))?.tracking_token ?? null;
      } catch (e) {
        console.warn('[create-order] delivery not created:', (e as Error).message);
      }
    }

    // Mint a single-purpose payment token: mock-pay refuses to mark this order
    // paid without it, so a random orderId is not enough to complete payment.
    const payToken = mintPayToken(atomicOrderId);

    return apiOk(
      {
        orderId: atomicOrderId,
        orderCode: result.order_code,
        subtotalKobo: result.subtotal_kobo,
        totalKobo: result.total_kobo,
        discountKobo: result.discount_kobo,
        discountCode: result.discount_code,
        deliveryMethod,
        deliveryFeeKobo: result.delivery_fee_kobo,
        payToken,
        trackingToken,
        replayed: false,
      },
      201,
    );
  } catch (err) {
    return internalError('create-order', err);
  }
}
