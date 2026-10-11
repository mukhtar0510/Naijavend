'use client';

import { useState, useRef, useEffect } from 'react';
import { sanitizeText } from '@idevtenancy/shared';

interface Answer {
  reply: string;
  stores?: Array<{ slug: string; name: string; category: string }>;
  orders?: Array<{ id: string; storeSlug: string; storeName: string; totalKobo: number; status: string }>;
  listings?: Array<{ storeSlug: string; title: string; priceKobo: number }>;
}

const SUGGESTIONS = [
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
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      const data = (await res.json()) as { error?: { code: string; message: string }; reply?: string; stores?: Answer['stores']; orders?: Answer['orders']; listings?: Answer['listings'] };

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
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Ask Naijavend</h1>
        <span className="muted" style={{ fontSize: 13 }}>your shopping assistant</span>
      </div>
      <p className="muted" style={{ marginBottom: 22 }}>
        Ask about stores, products, prices, your orders and bookings — the assistant answers from the
        marketplace catalogue and your own account, not guesses.
      </p>

      <section style={{ background: 'var(--elevated-1)', borderRadius: '14px', padding: '16px', marginBottom: 18 }}>
        <textarea
          className="ai-composer"
          rows={3}
          placeholder="Ask anything — e.g. “who sells cakes in Lekki?” or “where is my last order?”"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status === 'asking'}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip btn-outline btn-sm"
                onClick={() => { setQuestion(s); }}
                disabled={status === 'asking'}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={status === 'asking'}
          >
            {status === 'asking' ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </section>

      {status === 'error' && (
        <div className="alert alert-error" style={{ borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
          {errorMsg}
        </div>
      )}

      {answer && (
        <section style={{ background: 'var(--elevated-1)', borderRadius: '14px', padding: '16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div className="ai-avatar" aria-hidden> assistant</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Naijavend shopping assistant</div>
              {source && (
                <div className="muted" style={{ fontSize: 12 }}>powered by {source}</div>
              )}
            </div>
          </div>

          <div className="ai-reply" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15 }}>
            {answer.reply}
          </div>

          {answer.orders && answer.orders.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Your recent orders</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {answer.orders.map((o) => (
                  <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-inset)' }}>
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
            <div style={{ marginTop: 14 }}>
              {answer.listings.map((it) => (
                <a
                  key={`${it.storeSlug}-${it.title}`}
                  href={`/s/${it.storeSlug}`}
                  className="chip btn-outline btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  {it.title} — ₦{Math.round(it.priceKobo / 100).toLocaleString('en-NG')}
                </a>
              ))}
            </div>
          )}

          {answer.stores && answer.stores.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {answer.stores.map((s) => (
                <a
                  key={s.slug}
                  href={`/s/${s.slug}`}
                  className="chip btn-outline"
                  style={{ textDecoration: 'none' }}
                >
                  {s.name} {s.category ? `· ${s.category}` : ''}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {status === 'idle' && (
        <div className="muted" style={{ fontSize: 13 }}>
          Only stores listed on Naijavend and your own orders/bookings are used to answer. Nothing is invented.
        </div>
      )}

      <div ref={bottom} />
    </main>
  );
}
