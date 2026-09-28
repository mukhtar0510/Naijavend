import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { ChatInbox } from './ChatInbox';
import type { Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export interface InboxThread {
  key: string;
  customerId: string | null;
  displayName: string;
  lastBody: string;
  lastAt: string;
  count: number;
  unread: number;
}

export default async function SellerChatPage() {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin'); // layout redirect races this page — guard here too
  const store = await getOwnStore<Pick<Store, 'id' | 'name' | 'slug'>>(sb, 'id, name, slug');
  if (!store) {
    return (
      <main>
        <h1>Chat</h1>
        <p className="muted">Create your store first.</p>
        <Link href="/dashboard/onboarding" className="btn btn-primary">Set up my store</Link>
      </main>
    );
  }
  const s = store as Pick<Store, 'id' | 'name' | 'slug'>;

  const { data: userData } = await sb.auth.getUser();
  const sellerId = userData.user?.id ?? null;

  const { data: rows, error } = await sb
    .from('chat_messages')
    .select('id, store_id, customer_id, sender, body, created_at')
    .eq('store_id', s.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    return (
      <main>
        <h1>Chat</h1>
        <div className="alert alert-error">Could not load messages: {error.message}</div>
      </main>
    );
  }

  // Customer display names: the "customers chat name read" policy lets a store
  // owner read the display name of any customer who has chatted with them.
  const customerIds = [...new Set((rows ?? []).map((m) => m.customer_id).filter(Boolean))] as string[];
  const nameMap = new Map<string, string>();
  if (customerIds.length) {
    const { data: custs } = await sb
      .from('customers')
      .select('id, full_name')
      .in('id', customerIds);
    for (const c of custs ?? []) {
      nameMap.set(c.id, (c.full_name as string)?.trim() || '');
    }
  }

  // Group into threads by customer; anonymous threads (null customer) group by their first message id.
  type Thread = { key: string; customerId: string | null; lastBody: string; lastAt: string; count: number };
  const threads = new Map<string, Thread>();
  for (const m of rows ?? []) {
    const key = m.customer_id ?? `anon-${(m as { id: string }).id}`;
    const t = threads.get(key);
    if (t) {
      t.count += 1;
    } else {
      threads.set(key, {
        key,
        customerId: m.customer_id,
        lastBody: m.body,
        lastAt: m.created_at,
        count: 1,
      });
    }
  }

  // Unread = customer messages newer than the seller's last-read marker.
  const threadIdFor = (customerId: string | null) => `${s.id}:${customerId ?? 'anon'}`;
  let sellerRead: Map<string, string> = new Map();
  if (sellerId) {
    const { data: reads } = await sb
      .from('chat_read_state')
      .select('thread_id, last_read_at')
      .eq('user_id', sellerId);
    sellerRead = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));
  }

  const threadList: InboxThread[] = [...threads.values()]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .map((t) => {
      const tid = threadIdFor(t.customerId);
      const seen = sellerRead.get(tid);
      let unread = 0;
      for (const m of rows ?? []) {
        const mk = m.customer_id ?? `anon-${(m as { id: string }).id}`;
        if (mk !== t.key || m.sender !== 'customer') continue;
        if (!seen || m.created_at > seen) unread += 1;
      }
      const fallback = t.customerId ? `Customer ${t.customerId.slice(0, 8)}…` : 'Guest visitor';
      return {
        key: t.key,
        customerId: t.customerId,
        displayName: (t.customerId && nameMap.get(t.customerId)) || fallback,
        lastBody: t.lastBody,
        lastAt: t.lastAt,
        count: t.count,
        unread,
      };
    });

  return (
    <main>
      <h1>Chat</h1>
      <p className="muted">
        Conversations from your store sites. Customers start chats from any listing — reply here and it lands on their phone.
      </p>
      <ChatInbox
        storeId={s.id}
        sellerId={sellerId}
        threads={threadList}
      />
    </main>
  );
}
