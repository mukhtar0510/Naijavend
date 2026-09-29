'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@idevtenancy/shared';

interface ChatApiMessage {
  id: string;
  sender: 'customer' | 'seller';
  body: string;
  created_at: string;
}

// Local-time day bucket — matches dayLabel's local "Today/Yesterday". A UTC
// bucket would split one evening (Nigeria is UTC+1) into two days.
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

// Polling chat thread shared by the customer page and the seller inbox.
// Polls every 4s: the seller thread uses server-rendered history plus this
// same polling loop, so both sides converge without a websocket layer.
export function ChatBox({
  storeId,
  customerId,
  role,
  disabled,
  disabledHint,
}: {
  storeId: string;
  customerId?: string | null;
  role: 'customer' | 'seller';
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [messages, setMessages] = useState<ChatApiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Track whether the user is reading at the bottom. Only auto-scroll when
  // they are — otherwise new messages would yank them away from history.
  const onScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?storeId=${storeId}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not load the conversation.');
      setMessages((body.messages as ChatApiMessage[]) ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [storeId]);

  // Stamp the customer's read marker when the latest message changes while the
  // tab is visible, so the seller's replies stop counting as unread in the
  // customer's inbox. (The seller stamps on thread-open in ChatInbox.) Gated on
  // the newest message id so the 4s poll doesn't re-POST an identical marker
  // forever; hidden-tab visits are skipped entirely.
  const lastSeenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (role !== 'customer' || messages.length === 0) return;
    const newestId = messages[messages.length - 1]!.id;
    if (newestId === lastSeenIdRef.current) return;
    lastSeenIdRef.current = newestId;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const threadId = `${storeId}:me`;
    void fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    }).catch(() => {
      // non-fatal: unread badge simply survives until the next poll cycle
    });
  }, [role, storeId, messages]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (atBottomRef.current) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const optimistic: ChatApiMessage = {
      id: `tmp-${Date.now()}`,
      sender: role === 'seller' ? 'seller' : 'customer',
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, body: text, ...(role === 'seller' ? { customerId } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not send the message.');
      // Replace the optimistic row with the persisted one; a 4s poll landing
      // in between previously evicted the optimistic message for seconds.
      setMessages((prev) => {
        const withoutTmp = prev.filter((m) => m.id !== optimistic.id);
        if (withoutTmp.some((m) => m.id === body.message.id)) return withoutTmp;
        return [...withoutTmp, body.message as ChatApiMessage].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        );
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text); // give the user their words back to retry
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-shell">
      <div className="chat-log" ref={logRef} onScroll={onScroll}>
        {messages.length === 0 && !error && (
          <p className="muted" style={{ margin: 'auto', fontSize: 14.5 }}>
            No messages yet — say hello 👋
          </p>
        )}
        {messages.map((m, i) => {
          const mine = role === 'seller' ? m.sender === 'seller' : m.sender === 'customer';
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const grouped = !!prev && prev.sender === m.sender && !newDay;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="chat-day" role="separator">
                  <span>{dayLabel(m.created_at)}</span>
                </div>
              )}
              <div className={`chat-row ${mine ? 'mine' : 'theirs'}${grouped ? ' is-grouped' : ''}`}>
                <div className="chat-bubble">
                  {m.body}
                  <span className="chat-time">{timeOf(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="alert alert-error" style={{ margin: '10px 12px 0' }}>{error}</div>}
      {disabled ? (
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{disabledHint}</p>
        </div>
      ) : (
        <form className="chat-form" onSubmit={send}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <button className="btn btn-primary chat-send" type="submit" disabled={sending || !draft.trim()}>
            {sending ? '…' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}

export type { ChatMessage };
