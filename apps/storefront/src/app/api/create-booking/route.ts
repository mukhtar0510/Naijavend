// create-booking — validates slot availability server-side before writing (blueprint §4).
// Double-booking is additionally blocked by the Postgres exclusion constraint on bookings.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getCustomerUser } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText, isValidPhone } from '@idevtenancy/shared';

const SLOT_MS = 60 * 60 * 1000; // 1-hour slots at MVP

export async function POST(req: NextRequest) {
  const rl = rateLimit(`create-booking:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many booking attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const listingId = sanitizeText(b.listingId, 40);
  const customerName = sanitizeText(b.customerName, 120);
  const customerPhone = sanitizeText(b.customerPhone, 16);
  const slotStartRaw = sanitizeText(b.slotStart, 40);

  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return apiError(400, 'invalid_listing', 'Invalid listing.');
  if (customerName.length < 2) return apiError(400, 'invalid_name', 'Enter your full name.');
  if (!isValidPhone(customerPhone)) return apiError(422, 'invalid_phone', 'Enter a valid phone number, e.g. +2348012345678.');

  const slotStart = new Date(slotStartRaw);
  if (Number.isNaN(slotStart.getTime())) {
    return apiError(422, 'invalid_slot', 'Pick a valid date and time.');
  }
  if (slotStart.getTime() < Date.now()) {
    return apiError(422, 'past_slot', 'Pick a time in the future.');
  }
  const slotEnd = new Date(slotStart.getTime() + SLOT_MS);

  try {
    const sb = supabaseService();

    const { data: listing, error: listingErr } = await sb
      .from('listings')
      .select('id, is_bookable, store_id, stores!inner(slug)')
      .eq('id', listingId)
      .maybeSingle();
    if (listingErr) throw listingErr;
    if (!listing) return apiError(404, 'listing_not_found', 'That service does not exist.');
    if ((listing.stores as unknown as { slug: string }).slug !== slug) {
      return apiError(422, 'listing_mismatch', 'That service does not belong to this store.');
    }
    if (!listing.is_bookable) return apiError(422, 'not_bookable', 'This service does not take appointments.');

    // Availability check: any non-cancelled booking overlapping the slot.
    const { data: conflicts, error: conflictErr } = await sb
      .from('bookings')
      .select('id')
      .eq('listing_id', listingId)
      .neq('status', 'cancelled')
      .lt('slot_start', slotEnd.toISOString())
      .gt('slot_end', slotStart.toISOString())
      .limit(1);
    if (conflictErr) throw conflictErr;
    if (conflicts && conflicts.length > 0) {
      return apiError(409, 'slot_taken', 'That time was just booked. Pick another slot.');
    }

    // Attribute the booking to the signed-in customer (if any) so it shows in /account/bookings.
    const customer = await getCustomerUser();

    const { error: insertErr } = await sb.from('bookings').insert({
      listing_id: listingId,
      customer_id: customer?.id ?? null,
      customer_name: customerName,
      customer_phone: customerPhone,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      status: 'pending',
    });
    if (insertErr) {
      // The DB exclusion constraint is the last line of defense against double-booking.
      if (String(insertErr.message).includes('bookings_no_overlap')) {
        return apiError(409, 'slot_taken', 'That time was just booked. Pick another slot.');
      }
      throw insertErr;
    }

    return apiOk({ booked: true }, 201);
  } catch (err) {
    return internalError('create-booking', err);
  }
}
