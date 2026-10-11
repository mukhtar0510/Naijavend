'use client';

import { useState, useRef, useEffect } from 'react';
import { sanitizeText } from '@idevtenancy/shared';

interface Answer {
  reply: string;
  stores?: Array<{ slug: string; name: string; category: string }>;
  orders?: Array<{ id: string; storeSlug: string; storeName: string; totalKobo: number; status: string }>;
  listings?: Array<{ storeSlug: string; title: string; priceKobo: number }>;
}

const STARTERS = [
  'Who sells cakes near me?',
  'Where is my last order?',
  'What should I buy for a small wedding?',
  'Show me trusted phone repair stores',
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [status, setStatus] = useState<'idle' | 'asking' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [answer, status]);

  const send = async () => {
    const q = sanitizeText(question, 300);
    if (!q.trim()) return;
    setStatus('asking');
    setErrorMsg('');
    setAnswer(null);

    try {
      const res = await fetch('/account/ai/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const data = (await res.json()) as {
        error?: { code: string; message: string };
        reply?: string;
        stores?: Answer['stores'];
        orders?: Answer['orders'];
        listings?: Answer['listings'];
      };

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error?.message ?? 'Something went wrong.');
        return;
      }

      setAnswer(data as Answer);
      setSource(res.headers?.get?.('x-ai-source') ?? null);
      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main className="ai-app">
      <header className="ai-app-top">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>💬 Ask Naijavend</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Your shopping assistant · catalogue + your own orders and bookings
          </span>
        </div>
        {source && (
          <span
            className="ai-provider-badge"
            title={`powered by ${source}`}
          >
            powered by {source}
          </span>
        )}
      </header>

      <div className="ai-app-thread" ref={threadRef} aria-live="polite">
        {answer ? (
          <>
            <div className="ai-bubble ai-bubble-bot">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <strong>Naijavend shopping assistant</strong>
                {source && <span className="ai-provider-badge">powered by {source}</span>}
              </div>
              <div className="ai-reply">{answer.reply}</div>

              {answer.orders && answer.orders.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Your recent orders</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {answer.orders.map((o) => (
                      <li
                        key={o.id}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-inset)' }}
                      >
                        <span>
                          <strong>{o.storeName}</strong>
                          <span className="muted" style={{ marginLeft: 6 }}>₦{Math.round(o.totalKobo / 100).toLocaleString('en-NG')}</span>
                        </span>
                        <span className={`badge badge-sm ${o.status === 'fulfilled' ? 'badge-success' : o.status === 'cancelled' ? 'badge-danger' : 'badge-black'}`}>{o.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {answer.listings && answer.listings.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {answer.listings.map((it) => (
                    <a
                      key={`${it.storeSlug}-${it.title}`}
                      href={`/s/${it.storeSlug}`}
                      className="ai-chip"
                    >
                      {it.title} — ₦{Math.round(it.priceKobo / 100).toLocaleString('en-NG')}
                    </a>
                  ))}
                </div>
              )}

              {answer.stores && answer.stores.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {answer.stores.map((s) => (
                    <a
                      key={s.slug}
                      href={`/s/${s.slug}`}
                      className="ai-chip ai-chip-active"
                    >
                      {s.name} {s.category ? `· ${s.category}` : ''}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="ai-app-empty">
            <div className="ai-app-empty-icon">🛍️</div>
            <h3>Ask Naijavend</h3>
            <p className="muted">
              Ask about stores, products, prices, your orders and bookings — the assistant answers from the
              marketplace catalogue and your own account, not guesses.
            </p>
            <div className="ai-app-starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="ai-chip" onClick={() => setQuestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="alert alert-error" style={{ marginBottom: 10 }}>
            {errorMsg}
          </div>
        )}

        {status === 'asking' && (
          <div className="ai-bubble ai-bubble-bot ai-bubble-typing">Asking Naijavend…</div>
        )}
      </div>

      {status === 'idle' && !answer && (
        <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '6px 12px 10px' }}>
          Only stores listed on Naijavend and your own orders/bookings are used to answer. Nothing is invented.
        </div>
      )}

      <form className="ai-app-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          className="ai-app-input"
          value={question}
          rows={1}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status === 'asking'}
          placeholder="Ask anything — e.g. “who sells cakes in Lekki?” or “where is my last order?”"
          maxLength={300}
          aria-label="Ask Naijavend"
        />
        <button
          type="submit"
          className="btn btn-primary ai-app-send"
          disabled={status === 'asking' || !question.trim()}
        >
          {status === 'asking' ? 'Asking…' : 'Ask'}
        </button>
      </form>
    </main>
  );
}
