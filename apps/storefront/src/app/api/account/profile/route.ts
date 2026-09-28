// Customer profile self-service edits (name, phone, avatar). Runs with the
// customer's own JWT — the customers_self_all RLS policy scopes every update
// to auth.uid() = id, so a customer can only ever change their own row.
import { NextRequest } from 'next/server';
import { getCustomerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function PATCH(req: NextRequest) {
  const sb = await getCustomerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  // Cheap to call, and profile edits are an abuse vector for spam names/links.
  const rl = rateLimit(`profile:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many updates. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;

  const updates: Record<string, string | null> = {};

  if (b.fullName !== undefined) {
    const fullName = sanitizeText(b.fullName, 80);
    if (fullName.length < 2) return apiError(422, 'invalid_name', 'Name needs at least 2 characters.');
    updates.full_name = fullName;
  }
  if (b.phone !== undefined) {
    const phone = sanitizeText(b.phone, 20).replace(/[\s()-]/g, '');
    if (phone && !/^\+?\d{7,15}$/.test(phone)) {
      return apiError(422, 'invalid_phone', 'Enter a valid phone number (7–15 digits, optional +).');
    }
    updates.phone = phone; // empty string clears the phone
  }
  if (b.avatarUrl !== undefined) {
    const raw = typeof b.avatarUrl === 'string' ? b.avatarUrl : '';
    if (raw === '') {
      updates.avatar_url = null; // removing the avatar
    } else {
      // Only URLs pointing into the avatars bucket are accepted — the value is
      // rendered on public pages, so this keeps it from becoming an injection
      // or redirect vector.
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
      if (!raw.startsWith(prefix)) {
        return apiError(422, 'invalid_avatar', 'Avatar must be uploaded through Naijavend.');
      }
      updates.avatar_url = raw;
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError(400, 'nothing_to_update', 'Nothing to update.');
  }

  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    // Upsert (not update): the customers row is created lazily elsewhere, so
    // a first-time profile save must INSERT — and customers_self_all RLS
    // allows exactly that (auth.uid() = id). On an existing row only the
    // provided columns are touched.
    const { error } = await sb.from('customers').upsert({ id: userId, ...updates }, { onConflict: 'id' });
    if (error) {
      if (String(error.message).toLowerCase().includes('row-level security')) {
        return apiError(403, 'forbidden', 'You can only edit your own profile.');
      }
      throw error;
    }
    return apiOk({ ok: true, updated: Object.keys(updates) });
  } catch (err) {
    return internalError('account-profile', err);
  }
}
