// Buyer conversations — every store thread the signed-in customer has, with
// the store's name/slug, the last message, and an unread count (messages from
// the seller newer than the customer's last-read marker). RLS on chat_messages
// scopes rows to customer_id = auth.uid(); stores are public-read.
import { NextRequest } from 'next/server';
import { getCustomerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';

export async function GET(_req: NextRequest) {
  try {
    const sb = await getCustomerClient();
    if (!sb) return apiError(401, 'sign_in_required', 'Sign in to see your conversations.');

    const { data: userData } = await sb.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return apiError(401, 'sign_in_required', 'Sign in to see your conversations.');

    const { data: rows, error } = await sb
      .from('chat_messages')
      .select('id, store_id, sender, body, created_at')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) throw error;

    const msgs = rows ?? [];

    // Group into threads per store (customer_id is always us on this query).
    type Thread = { storeId: string; lastBody: string; lastAt: string; unread: number };
    const threads = new Map<string, Thread>();
    for (const m of msgs) {
      const t = threads.get(m.store_id);
      if (t) continue; // rows are newest-first: first sight is the last message
      threads.set(m.store_id, { storeId: m.store_id, lastBody: m.body, lastAt: m.created_at, unread: 0 });
    }
    // Read markers: one row per thread this customer tracks.
    const { data: reads } = await sb
      .from('chat_read_state')
      .select('thread_id, last_read_at');
    const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));

    for (const m of msgs) {
      const t = threads.get(m.store_id);
      if (!t || m.sender !== 'seller') continue;
      const seen = readMap.get(`${m.store_id}:${uid}`);
      if (!seen || m.created_at > seen) t.unread += 1;
    }

    // Store names are public — fetch in one go.
    const storeIds = [...threads.keys()];
    const { data: stores } = await sb
      .from('stores')
      .select('id, name, slug')
      .in('id', storeIds.length ? storeIds : ['00000000-0000-0000-0000-000000000000']);
    const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));

    const list = [...threads.values()]
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
      .map((t) => {
        const s = storeMap.get(t.storeId);
        return {
          storeId: t.storeId,
          storeName: s?.name ?? 'Store',
          storeSlug: s?.slug ?? '',
          lastBody: t.lastBody,
          lastAt: t.lastAt,
          unread: t.unread,
        };
      });

    return apiOk({ conversations: list });
  } catch (err) {
    return internalError('chat-conversations', err);
  }
}
