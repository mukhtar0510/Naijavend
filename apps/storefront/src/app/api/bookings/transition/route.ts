// Booking status transitions for sellers: pending -> confirmed/cancelled,
// confirmed -> completed/cancelled.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

const ALLOWED: Record<string, string[]> = {
  confirmed: ['pending'],
  completed: ['confirmed'],
  cancelled: ['pending', 'confirmed'],
};

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const bookingId = sanitizeText(b.bookingId, 40);
  const next = sanitizeText(b.next, 20);

  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return apiError(400, 'invalid_booking', 'Invalid booking.');
  if (!(next in ALLOWED)) return apiError(422, 'invalid_transition', 'Unsupported status change.');

  try {
    const { data: booking } = await sb.from('bookings').select('id, status').eq('id', bookingId).maybeSingle();
    if (!booking) return apiError(404, 'booking_not_found', 'Booking not found (or not yours).');
    if (!(ALLOWED[next] as string[]).includes(booking.status)) {
      return apiError(409, 'invalid_transition', `Can't move a booking from ${booking.status} to ${next}.`);
    }

    const { error } = await sb.from('bookings').update({ status: next }).eq('id', bookingId).eq('status', booking.status);
    if (error) throw error;
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('bookings-transition', err);
  }
}
