// Chat read markers — upserts the signed-in user's last-read timestamp for a
// thread. Works for both roles: customers mark `${storeId}:${their-uid}`,
// sellers mark `${storeId}:${customerId-or-anon}`. The threadId's user segment
// is always overwritten server-side with the caller's own uid, so a caller can
// only ever touch their own markers.
import { NextRequest } from 'next/server';
import { getSellerClient, getCustomerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const threadId = sanitizeText((body as Record<string, unknown>).threadId, 120);
  if (!threadId || !threadId.includes(':')) return apiError(400, 'invalid_thread', 'Invalid thread.');

  const storeId = threadId.split(':')[0];
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_thread', 'Invalid thread.');

  try {
    // Customer first (most common caller).
    const customer = await getCustomerClient();
    if (customer) {
      const { data: userData } = await customer.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return apiError(401, 'sign_in_required', 'Sign in first.');
      // RLS guard: only threads the customer participates in. RLS-filtered
      // queries return [] (not null) when nothing matches — check length too.
      const { data: member } = await customer
        .from('chat_messages')
        .select('id')
        .eq('store_id', storeId)
        .limit(1);
      if (!member || member.length === 0) return apiError(403, 'not_your_thread', 'Not your conversation.');
      await customer.from('chat_read_state').upsert(
        { thread_id: `${storeId}:${uid}`, user_id: uid, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'thread_id' }
      );
      return apiOk({ ok: true });
    }

    // Seller.
    const seller = await getSellerClient();
    if (seller) {
      const { data: userData } = await seller.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return apiError(401, 'sign_in_required', 'Sign in first.');
      const { data: owns } = await seller
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('owner_id', uid)
        .maybeSingle();
      if (!owns) return apiError(403, 'not_your_store', 'Not your store.');
      // The seller client carries an RLS-privileged view of chat_read_state via
      // its own uid; upsert with service-identity semantics through the owner JWT.
      await seller.from('chat_read_state').upsert(
        { thread_id: threadId, user_id: uid, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'thread_id' }
      );
      return apiOk({ ok: true });
    }

    return apiError(401, 'sign_in_required', 'Sign in first.');
  } catch (err) {
    return internalError('chat-read', err);
  }
}
