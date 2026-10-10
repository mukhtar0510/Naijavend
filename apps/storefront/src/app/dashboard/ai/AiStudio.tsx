'use client';

// AI Studio — chat-app layout. One message thread (assistant chat + social
// post drafts look like messages), a sticky composer at the bottom, starter
// chips that send immediately, and a tools strip to open the social-post
// generator. Stateless: the last 10 messages ride along on every chat call.

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  kind?: 'text' | 'post';
}

const STARTERS = [
  'How do I get more orders this week?',
  'What should I post on WhatsApp status today?',
  'How should I price my products?',
];

const PLATFORMS = ['whatsapp', 'instagram', 'facebook'];

async function callApi(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json as { error?: { message?: string } })?.error?.message || 'Something went wrong. Try again.',
    );
  }
  return json as Record<string, unknown>;
}

export function AiStudio({ storeName }: { storeName: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Social-post generator (opened from the tools strip)
  const [toolsOpen, setToolsOpen] = useState(false);
  const [platform, setPlatform] = useState('whatsapp');
  const [copied, setCopied] = useState(false);

  // Latest generated caption, for the Copy button on post bubbles. A ref (not
  // state) because the same draft is already rendered in the thread.
  const latestPostRef = useRef('');

  // 'gemini' | 'basic' — surfaced so sellers know which brain answered.
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatBusy]);

  // --- Shared submit: composer form AND starter chips go through this, taking
  // the text as an argument so a chip press never races stale input state.
  async function sendChat(text: string, history: ChatMsg[] = messages) {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    const next = [...history, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setChatInput('');
    setChatBusy(true);
    setChatError('');
    try {
      const json = await callApi('/api/ai/assistant', {
        messages: next.filter((m) => m.kind !== 'post').slice(-10),
      });
      setProvider(typeof json.provider === 'string' ? json.provider : null);
      setMessages([...next, { role: 'assistant', content: String(json.reply ?? '') }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setChatBusy(false);
    }
  }

  async function generatePost(e?: FormEvent) {
    e?.preventDefault();
    const topic = chatInput.trim();
    if (topic.length < 3 || chatBusy) return;
    const next = [...messages, { role: 'user' as const, content: topic, kind: 'post' as const }];
    setMessages(next);
    setChatInput('');
    setChatBusy(true);
    setChatError('');
    try {
      const json = await callApi('/api/ai/social-post', { topic, platform });
      setProvider(typeof json.provider === 'string' ? json.provider : null);
      const draft = String(json.post ?? '');
      latestPostRef.current = draft;
      setMessages([...next, { role: 'assistant', content: draft, kind: 'post' }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setChatBusy(false);
    }
  }

  async function copyPost() {
    const post = latestPostRef.current;
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — the text is
      // selectable in the bubble anyway.
    }
  }

  const empty = messages.length === 0;

  return (
    <main className="ai-app">
      {/* Header — title, provider badge, tools toggle */}
      <header className="ai-app-top">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>💬 AI Studio</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Smart help for {storeName} · grounded in your store, last 30 days
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {provider && (
            <span
              className="ai-provider-badge"
              title={provider === 'gemini' ? 'Answers drafted by Gemini' : 'Basic offline drafts — add GEMINI_API_KEY to unlock full AI'}
            >
              {provider === 'gemini' ? '✦ Gemini' : '✦ Basic mode'}
            </span>
          )}
          <button
            type="button"
            className={`ai-tool-btn ${toolsOpen ? 'ai-tool-btn-open' : ''}`}
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
            title="Social post generator"
          >
            📣 Social posts
          </button>
        </div>
      </header>

      {/* Thread — top-level scroll area, chat-app style */}
      <div className="ai-app-thread" ref={threadRef} aria-live="polite">
        {empty && (
          <div className="ai-app-empty">
            <div className="ai-app-empty-icon">👋</div>
            <h3>Welcome to AI Studio</h3>
            <p className="muted">
              Ask me anything about growing your store — orders, pricing, promotions — or open{' '}
              <strong>Social posts</strong> to draft a caption. No key needed to start.
            </p>
            <div className="ai-app-starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="ai-chip" onClick={() => sendChat(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`ai-bubble ${m.role === 'user' ? 'ai-bubble-user' : 'ai-bubble-bot'} ${m.kind === 'post' ? 'ai-bubble-post' : ''}`}
          >
            {m.content}
            {m.kind === 'post' && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={copyPost}>
                  {copied ? 'Copied ✓' : 'Copy caption'}
                </button>
              </div>
            )}
          </div>
        ))}
        {chatBusy && <div className="ai-bubble ai-bubble-bot ai-bubble-typing">Thinking…</div>}
        {chatError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{chatError}</div>}
      </div>

      {/* Tools strip — social-post platform picker */}
      {toolsOpen && (
        <div className="ai-app-tools">
          <span className="muted" style={{ fontSize: 12.5 }}>Draft a social post for …</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className={`ai-chip ${platform === p ? 'ai-chip-active' : ''}`}
                onClick={() => setPlatform(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer — sticky at the bottom like a chat app */}
      <form
        className="ai-app-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (toolsOpen) generatePost();
          else sendChat(chatInput);
        }}
      >
        <textarea
          ref={composerRef}
          className="ai-app-input"
          value={chatInput}
          rows={1}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (toolsOpen) generatePost();
              else sendChat(chatInput);
            }
          }}
          placeholder={toolsOpen ? 'What is the post about? e.g. New Ankara gowns just landed' : 'Ask about orders, pricing, promotions…'}
          maxLength={500}
          aria-label={toolsOpen ? 'Describe the social post' : 'Ask the assistant'}
        />
        <button
          type="submit"
          className="btn btn-primary ai-app-send"
          disabled={chatBusy || (toolsOpen ? chatInput.trim().length < 3 : !chatInput.trim())}
        >
          {chatBusy ? '…' : toolsOpen ? 'Draft post' : 'Send'}
        </button>
      </form>
    </main>
  );
}
