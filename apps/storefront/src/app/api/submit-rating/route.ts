// submit-rating — anti-fake-review validation (blueprint §4): the phone must match a real
// paid order or a booking with this store. One rating per phone per store (DB constraint).
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText, isValidPhone, isStars } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`submit-rating:${clientIp(req)}`, 6, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const customerPhone = sanitizeText(b.customerPhone, 16);
  const reference = sanitizeText(b.reference, 60);
  const comment = sanitizeText(b.comment, 1000);
  const stars = b.stars;

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (!isStars(stars)) return apiError(422, 'invalid_stars', 'Choose a rating from 1 to 5 stars.');
  if (!isValidPhone(customerPhone)) return apiError(422, 'invalid_phone', 'Enter the phone number you used for your order or booking.');

  try {
    const sb = supabaseService();

    const { data: store, error: storeErr } = await sb.from('stores').select('id').eq('slug', slug).maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');

    // Verify the customer transacted with this store.
    let orderId: string | null = null;
    let bookingId: string | null = null;

    if (reference) {
      const { data: order, error: orderErr } = await sb
        .from('orders')
        .select('id, customer_phone, store_id')
        .eq('payment_reference', reference)
        .maybeSingle();
      if (orderErr) throw orderErr;
      if (!order || order.store_id !== store.id) {
        return apiError(422, 'invalid_reference', 'That order reference doesn\'t match this store.');
      }
      if (order.customer_phone.replace(/[^0-9]/g, '') !== customerPhone.replace(/[^0-9]/g, '')) {
        return apiError(422, 'phone_mismatch', 'That order was placed with a different phone number.');
      }
      orderId = order.id;
    } else {
      // Digit-normalised match: the customer may type 08012345678 while the
      // order stored +2348012345678 (same rule the reference path uses).
      const buyerDigits = customerPhone.replace(/[^0-9]/g, '').replace(/^0/, '234').replace(/^234234/, '234');
      const { data: paidOrders, error: orderErr } = await sb
        .from('orders')
        .select('id, customer_phone')
        .eq('store_id', store.id)
        .in('status', ['paid', 'fulfilled'])
        .limit(50);
      if (orderErr) throw orderErr;
      const order = (paidOrders ?? []).find(
        (o) => String(o.customer_phone).replace(/[^0-9]/g, '').replace(/^0/, '234') === buyerDigits
      );

      const { data: bookings, error: bookingErr } = await sb
        .from('bookings')
        .select('id, customer_phone, listing_id, listings!inner(store_id)')
        .eq('listings.store_id', store.id)
        .limit(50);
      if (bookingErr) throw bookingErr;
      const booking = (bookings ?? []).find(
        (bk) => String(bk.customer_phone).replace(/[^0-9]/g, '').replace(/^0/, '234') === buyerDigits
      );

      if (order) orderId = order.id;
      else if (booking) bookingId = booking.id;
      else {
        return apiError(
          422,
          'no_transaction',
          'We couldn\'t find an order or booking with this phone number for this store. Only customers can review.'
        );
      }
    }

    const { error: insertErr } = await sb.from('store_ratings').insert({
      store_id: store.id,
      customer_phone: customerPhone,
      order_id: orderId,
      booking_id: bookingId,
      stars,
      comment,
    });
    if (insertErr) {
      if (String(insertErr.message).includes('ratings_unique_per_customer')) {
        return apiError(409, 'already_reviewed', 'You\'ve already reviewed this store.');
      }
      throw insertErr;
    }

    // Rankings refresh automatically via the DB trigger on store_ratings.

    return apiOk({ submitted: true }, 201);
  } catch (err) {
    return internalError('submit-rating', err);
  }
}
