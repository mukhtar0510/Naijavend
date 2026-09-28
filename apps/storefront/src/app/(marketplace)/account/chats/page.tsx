import type { Metadata } from 'next';
import Link from 'next/link';
import { getCustomerUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Your conversations — Naijavend' };

interface Convo {
  storeId: string;
  storeName: string;
  storeSlug: string;
  lastBody: string;
  lastAt: string;
  unread: number;
}

// Buyer chats: one row per store the customer has messaged. The thread itself
// is the existing /s/[slug]/chat page (ChatBox polls it live), so this page is
// a compact inbox that deep-links into each conversation.
export default async function BuyerChatsPage() {
  const user = await getCustomerUser();

  if (!user) {
    return (
      <div className="empty-state">
        <p>Sign in to see your conversations.</p>
        <Link href="/account/signin?next=/account/chats" className="btn btn-primary" style={{ marginTop: 10 }}>
          Sign in
        </Link>
      </div>
    );
  }

  // Server-fetch with the customer's own JWT so RLS scopes the rows.
  const { getCustomerClient } = await import('@/lib/auth');
  const sb = await getCustomerClient();

  let convos: Convo[] = [];
  let loadError: string | null = null;
  if (sb) {
    try {
      const { data: rows, error } = await sb
        .from('chat_messages')
        .select('id, store_id, sender, body, created_at')
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;

      type Thread = { storeId: string; lastBody: string; lastAt: string; unread: number };
      const threads = new Map<string, Thread>();
      for (const m of rows ?? []) {
        if (threads.has(m.store_id)) continue; // newest-first: first sight is last message
        threads.set(m.store_id, { storeId: m.store_id, lastBody: m.body, lastAt: m.created_at, unread: 0 });
      }
      const { data: reads } = await sb.from('chat_read_state').select('thread_id, last_read_at');
      const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));
      for (const m of rows ?? []) {
        const t = threads.get(m.store_id);
        if (!t || m.sender !== 'seller') continue;
        const seen = readMap.get(`${m.store_id}:${user.id}`);
        if (!seen || m.created_at > seen) t.unread += 1;
      }

      const storeIds = [...threads.keys()];
      const { data: stores } = await sb
        .from('stores')
        .select('id, name, slug')
        .in('id', storeIds.length ? storeIds : ['00000000-0000-0000-0000-000000000000']);
      const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));

      convos = [...threads.values()]
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
        .map((t) => {
          const s = storeMap.get(t.storeId);
          return {
            storeId: t.storeId,
            storeName: (s?.name as string) ?? 'Store',
            storeSlug: (s?.slug as string) ?? '',
            lastBody: t.lastBody,
            lastAt: t.lastAt,
            unread: t.unread,
          };
        });
    } catch (err) {
      loadError = (err as Error).message;
    }
  }

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>Your conversations</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Every chat you've started with a store — replies land here.
      </p>

      {loadError && <div className="alert alert-error">Could not load conversations: {loadError}</div>}

      {!loadError && convos.length === 0 && (
        <div className="empty-state">
          No chats yet. Message a store from any{' '}
          <Link href="/discover">store page</Link> and it shows up here.
        </div>
      )}

      <div className="convo-list">
        {convos.map((c) => (
          <Link
            key={c.storeId}
            href={c.storeSlug ? `/s/${c.storeSlug}/chat` : '/discover'}
            className={`convo-row${c.unread > 0 ? ' has-unread' : ''}`}
          >
            <div
              aria-hidden
              className="convo-avatar"
            >
              {c.storeName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 14.5 }}>{c.storeName}</strong>
                <span className="muted mono" style={{ fontSize: 11.5, flexShrink: 0 }}>
                  {new Date(c.lastAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="muted convo-preview">{c.lastBody}</p>
            </div>
            {c.unread > 0 && <span className="convo-unread">{c.unread > 9 ? '9+' : c.unread}</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
