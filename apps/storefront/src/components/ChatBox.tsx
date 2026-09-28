'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@idevtenancy/shared';

interface ChatApiMessage {
  id: string;
  sender: 'customer' | 'seller';
  body: string;
  created_at: string;
}

// Polling chat thread shared by the customer page and the seller inbox.
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

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, body: text, ...(role === 'seller' ? { customerId } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not send the message.');
      setMessages((prev) => [...prev, body.message as ChatApiMessage]);
      setDraft('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-shell">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && !error && (
          <p className="muted" style={{ margin: 'auto', fontSize: 14.5 }}>
            No messages yet — say hello 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = role === 'seller' ? m.sender === 'seller' : m.sender === 'customer';
          return (
            <div key={m.id} className={`chat-row ${mine ? 'mine' : 'theirs'}`}>
              <div className="chat-bubble">
                {m.body}
                <span className="chat-time">
                  {new Date(m.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                </span>
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
            maxLength={1000}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <button className="btn btn-primary" type="submit" disabled={sending || !draft.trim()}>
            {sending ? '…' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}

export type { ChatMessage };
