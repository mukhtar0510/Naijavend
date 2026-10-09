'use client';

// AI Studio client: two panels sharing one "which provider answered" badge.
// - Welcome/welcome: the first interaction is sign-up style — a welcome card
//   shows the studio's features and how-to-get-started steps before any chat
//   begins (no AI call needed to see it).
// - Assistant: stateless chat; the last 10 messages ride along on every call.
// - Social posts: topic + platform in, copy-ready caption out.

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'How do I get more orders this week?',
  'What should I post on WhatsApp status today?',
  'How should I price my products?',
  'How can I get more store visits?',
];

const FEATURES = [
  {
    icon: '💬',
    title: 'Business assistant',
    desc: 'Grounded in your own store — answers about orders, pricing, content, delivery and staffing, using your actual stats.',
  },
  {
    icon: '📣',
    title: 'Social posts',
    desc: 'Caption drafts shaped for WhatsApp status, Instagram or Facebook — copy, paste, schedule.',
  },
  {
    icon: '🎨',
    title: 'Store styling',
    desc: 'Theme palettes, fonts and layouts for your store site — the smartest first edit you can make.',
  },
  {
    icon: '📝',
    title: 'Listing descriptions',
    desc: 'Copy that sells each product or service, in your voice, with a WhatsApp nudge.',
  },
];

const HOW_TO = [
  'Tell me about your store — category, what you sell, what you want to grow.',
  'Pick a feature above or send me any question.',
  'I draft, you review, you publish. Every draft can be edited before use.',
];

function sendInitial(chatInput: React.Dispatch<React.SetStateAction<string>>, threadRef: React.RefObject<HTMLDivElement | null>, question: string) {
  chatInput(question);
  setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 30);
}

async function callApi(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || 'Something went wrong. Try again.');
  }
  return json as Record<string, unknown>;
}

export function AiStudio({ storeName }: { storeName: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  // Social post state
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('whatsapp');
  const [post, setPost] = useState('');
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState('');
  const [copied, setCopied] = useState(false);

  // 'gemini' | 'dummy' | 'welcome' — surfaced so sellers know which brain answered.
  const [provider, setProvider] = useState<string | null>(null);

  const chatInputRef = useRef<HTMLInputElement>(null);

  async function sendChat(e?: FormEvent) {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setChatInput('');
    setChatBusy(true);
    setChatError('');
    try {
      const json = await callApi('/api/ai/assistant', { messages: next.slice(-10) });
      setProvider(typeof json.provider === 'string' ? json.provider : null);
      setMessages([...next, { role: 'assistant', content: String(json.reply ?? '') }]);
      setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 30);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setChatBusy(false);
    }
  }

  async function generatePost() {
    if (topic.trim().length < 3 || postBusy) return;
    setPostBusy(true);
    setPostError('');
    setCopied(false);
    try {
      const json = await callApi('/api/ai/social-post', { topic, platform });
      setProvider(typeof json.provider === 'string' ? json.provider : null);
      setPost(String(json.post ?? ''));
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPostBusy(false);
    }
  }

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — the text is
      // selectable in the preview box anyway.
    }
  }

  function focusChatInput() {
    chatInputRef.current?.focus();
  }

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>AI Studio</h1>
        {provider && (
          <span className="ai-provider-badge" title={provider === 'gemini' ? 'Answers drafted by Gemini' : 'Basic offline drafts — add GEMINI_API_KEY to unlock full AI'}>
            {provider === 'gemini' ? '✦ Gemini' : provider === 'welcome' ? '✦ Welcome' : '✦ Basic mode'}
          </span>
        )}
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Smart help for {storeName}: ask the assistant anything about growing your store, or draft a ready-to-share post.
      </p>

      {messages.length === 0 && (
        <section className="card card-elevated ai-welcome">
          <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>👋 Welcome to AI Studio</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Smart help for {storeName}, built in. No key needed to start — the personalised drafts turn on when GEMINI_API_KEY is set (Google AI Studio, free tier).
          </p>

          <div className="ai-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="ai-feature">
                <div className="ai-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p className="muted" style={{ fontSize: 13 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="ai-howto">
            <h3 style={{ margin: '14px 0 6px' }}>Now — start with a question about your store</h3>
            <ol className="ai-howto-list">
              {HOW_TO.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="ai-chips">
            <button type="button" className="ai-chip ai-chip-pick" onClick={() => { setChatInput('I sell handmade beads and craft kits — how do I get more orders?'); sendChat(); focusChatInput(); }}>
              ✨ I sell handmade beads and craft kits
            </button>
            <button type="button" className="ai-chip ai-chip-pick" onClick={() => { setChatInput('What should I post on WhatsApp status today?'); sendChat(); focusChatInput(); }}>
              📣 WhatsApp status post
            </button>
            <button type="button" className="ai-chip ai-chip-pick" onClick={() => { setChatInput('How should I price my products?'); sendChat(); focusChatInput(); }}>
              💰 Product pricing
            </button>
          </div>
        </section>
      )}

      {messages.length === 0 && (
        <div className="ai-chips">
          <button type="button" className="ai-chip" onClick={() => { setChatInput('I sell handmade beads and craft kits — how do I get more orders?'); sendChat(); focusChatInput(); }}>
            ✨ I sell handmade beads and craft kits
          </button>
          <button type="button" className="ai-chip" onClick={() => { setChatInput('What should I post on WhatsApp status today?'); sendChat(); focusChatInput(); }}>
            📣 WhatsApp status post
          </button>
          <button type="button" className="ai-chip" onClick={() => { setChatInput('How should I price my products?'); sendChat(); focusChatInput(); }}>
            💰 Product pricing
          </button>
        </div>
      )}

      <div className="ai-grid">
        {/* ------------------------------ Assistant ------------------------------ */}
        <section className="card card-elevated ai-panel" style={{ display: messages.length === 0 ? 'none' : 'block' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>💬 Business assistant</h2>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            Grounded in your store — listings, orders and visits from the last 30 days.
          </p>

          <div className="ai-thread" ref={threadRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`ai-bubble ${m.role === 'user' ? 'ai-bubble-user' : 'ai-bubble-bot'}`}>
                {m.content}
              </div>
            ))}
            {chatBusy && <div className="ai-bubble ai-bubble-bot ai-bubble-typing">Thinking…</div>}
          </div>

          <form className="ai-composer" onSubmit={sendChat}>
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about orders, pricing, promotions…"
              maxLength={500}
              aria-label="Ask the assistant"
            />
            <button type="submit" className="btn btn-primary" disabled={chatBusy || !chatInput.trim()}>
              Send
            </button>
          </form>
          {chatError && <div className="alert alert-error" style={{ marginTop: 10 }}>{chatError}</div>}
        </section>

        {/* ----------------------------- Social posts ---------------------------- */}
        <section className="card card-elevated ai-panel" style={{ display: messages.length === 0 ? 'none' : 'block' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>📣 Social posts</h2>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            Describe a product or promo — get a caption shaped for the platform, ready to copy.
          </p>

          <div className="field">
            <label htmlFor="ai-post-topic">What is the post about?</label>
            <input
              id="ai-post-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder="e.g. New Ankara gowns just landed — weekend promo"
            />
          </div>

          <div className="field">
            <label htmlFor="ai-post-platform">Platform</label>
            <select id="ai-post-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {FEATURES.slice(1, 4).map((p) => (
                <option key={p.title} value={p.title.toLowerCase()}>{p.title}</option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-primary" onClick={generatePost} disabled={postBusy || topic.trim().length < 3}>
            {postBusy ? 'Drafting…' : post ? 'Draft another' : 'Draft post'}
          </button>

          {post && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>Preview</label>
              <div className="ai-post-preview">{post}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn" onClick={copyPost}>{copied ? 'Copied ✓' : 'Copy caption'}</button>
              </div>
            </div>
          )}
          {postError && <div className="alert alert-error" style={{ marginTop: 10 }}>{postError}</div>}
        </section>
      </div>
    </main>
  );
}
