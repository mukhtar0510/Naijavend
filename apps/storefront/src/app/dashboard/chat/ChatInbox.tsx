'use client';

import { useCallback, useState } from 'react';
import { ChatBox } from '@/components/ChatBox';
import type { InboxThread } from './page';

export function ChatInbox({
  storeId,
  sellerId,
  threads: initialThreads,
}: {
  storeId: string;
  sellerId: string | null;
  threads: InboxThread[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [active, setActive] = useState<string | null>(initialThreads[0]?.key ?? null);
  const activeThread = threads.find((t) => t.key === active) ?? null;

  // Opening a thread clears its unread badge locally and stamps the seller's
  // last-read marker so the count stays correct across reloads.
  const openThread = useCallback(
    async (key: string) => {
      setActive(key);
      setThreads((prev) => prev.map((t) => (t.key === key ? { ...t, unread: 0 } : t)));
      const thread = threads.find((t) => t.key === key);
      if (!thread || !sellerId) return;
      const threadId = `${storeId}:${thread.customerId ?? 'anon'}`;
      try {
        await fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId }),
        });
      } catch {
        // non-fatal: badge returns on next load if the stamp failed
      }
    },
    [threads, storeId, sellerId]
  );

  if (threads.length === 0) {
    return (
      <div className="empty-state">
        No conversations yet. When a customer messages you from your store site, it shows up here.
      </div>
    );
  }

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, marginTop: -6 }}>
        {totalUnread > 0 ? `💬 ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : 'All caught up ✅'}
      </p>
      <div className="chat-inbox">
        <div className="thread-list">
          {threads.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`thread-row${t.key === active ? ' is-active' : ''}`}
              onClick={() => void openThread(t.key)}
            >
              <div className="thread-avatar" aria-hidden>
                {t.displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 14.5 }}>{t.displayName}</strong>
                  <span className="muted mono" style={{ fontSize: 11.5, flexShrink: 0 }}>
                    {new Date(t.lastAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="muted thread-preview">{t.lastBody}</p>
                <span className="muted mono" style={{ fontSize: 11.5 }}>
                  {t.count} message{t.count === 1 ? '' : 's'}
                </span>
              </div>
              {t.unread > 0 && <span className="convo-unread">{t.unread > 9 ? '9+' : t.unread}</span>}
            </button>
          ))}
        </div>

        <div className="chat-inbox-thread">
          {activeThread ? (
            <>
              <h2 style={{ fontSize: 17, marginBottom: 10 }}>{activeThread.displayName}</h2>
              <ChatBox storeId={storeId} customerId={activeThread.customerId} role="seller" />
            </>
          ) : (
            <div className="empty-state">Pick a conversation on the left.</div>
          )}
        </div>
      </div>
    </>
  );
}
