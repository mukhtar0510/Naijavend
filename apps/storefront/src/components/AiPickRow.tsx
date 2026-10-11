'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Pick {
  kind: string;
  slug: string;
  name: string;
  reason: string;
}

interface AskStoreLink {
  slug: string;
  name: string;
  category: string;
}

interface AskMsg {
  q: string;
  reply: string;
  stores: AskStoreLink[];
}

// Buyer-facing "AI picks for you" on Discover. Two surfaces:
//  1. Customizable recommendations — the shopper types their own interest
//     (renameable at any moment, remembered locally) and the AI re-ranks the
//     marketplace with it; every pick is a real link to the store.
//  2. "Ask the AI" — a catalog-grounded question box. Answers only quote what
//     is actually listed (prices, categories, distances) and always end with
//     tappable store links; off-catalogue questions get an honest no-match.
// Proximity feeds both from the viewer's saved location.
export function AiPickRow() {
  const [interest, setInterest] = useState('');
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [source, setSource] = useState<string>('fallback');
  const [busy, setBusy] = useState(false);

  const [askOpen, setAskOpen] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askThread, setAskThread] = useState<AskMsg[]>([]);
  const askEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInterest(window.localStorage.getItem('nv-ai-interest') ?? '');
    void run(window.localStorage.getItem('nv-ai-interest') ?? '', readLoc());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    // Keep the newest answer in view inside the thread.
    if (askThread.length > 0) askEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [askThread]);

  function readLoc(): { lat: number; lng: number; label?: string } | null {
    try {
      const raw = window.localStorage.getItem('sf-loc');
      return raw ? (JSON.parse(raw) as { lat: number; lng: number; label?: string }) : null;
    } catch {
      return null;
    }
  }

  const run = useCallback(async (q: string, loc: { lat: number; lng: number; label?: string } | null) => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (loc?.lat && loc?.lng) {
        params.set('lat', String(loc.lat));
        params.set('lng', String(loc.lng));
        if (loc.label) params.set('label', loc.label);
      }
      const res = await fetch(`/api/discover/recommend?${params.toString()}`);
      const body = (await res.json()) as { ok?: boolean; picks?: Pick[]; source?: string };
      if (body.ok && Array.isArray(body.picks)) {
        setPicks(body.picks);
        setSource(body.source ?? 'fallback');
      } else {
        setPicks(null);
      }
    } catch {
      setPicks(null);
    } finally {
      setBusy(false);
    }
  }, []);

  async function ask() {
    const q = askInput.trim();
    if (!q || askBusy) return;
    setAskBusy(true);
    setAskInput('');
    setAskThread((t) => [...t, { q, reply: '…', stores: [] }]);
    try {
      const loc = readLoc();
      const res = await fetch('/api/discover/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q,
          ...(loc?.lat && loc?.lng ? { lat: loc.lat, lng: loc.lng } : {}),
          ...(loc?.label ? { label: loc.label } : {}),
        }),
      });
      const body = (await res.json()) as { ok?: boolean; reply?: string; stores?: AskStoreLink[]; error?: { message?: string } };
      setAskThread((t) => [
        ...t.slice(0, -1),
        { q, reply: body.ok ? (body.reply ?? 'Hmm — try rephrasing.') : (body.error?.message ?? 'Something went wrong. Try again.'), stores: body.ok ? (body.stores ?? []) : [] },
      ]);
    } catch {
      setAskThread((t) => [...t.slice(0, -1), { q, reply: 'Network hiccup — try again.', stores: [] }]);
    } finally {
      setAskBusy(false);
    }
  }

  function runWithCurrent() {
    const loc = readLoc();
    window.localStorage.setItem('nv-ai-interest', interest);
    void run(interest, loc);
  }

  function clearInterest() {
    setInterest('');
    window.localStorage.removeItem('nv-ai-interest');
    void run('', readLoc());
  }

  return (
    <section className="ai-picks" aria-label="AI shopping assistant">
      <div className="ai-picks-head">
        <h2>✨ AI picks for you</h2>
        <span className={`ai-picks-src${source === 'gemini' ? ' live' : ''}`} title={source === 'gemini' ? 'Live Gemini recommendations' : 'Smart on-marketplace ranking'}>
          {source === 'gemini' ? 'Gemini' : 'Smart rank'}
        </span>
      </div>
      <div className="ai-picks-controls">
        <input
          type="text"
          className="ai-picks-input"
          placeholder="What are you shopping for? (e.g. birthday cake, phone repair, ebooks…)"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          maxLength={80}
          aria-label="Customize your AI picks"
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={runWithCurrent} disabled={busy}>
          {busy ? 'Thinking…' : 'Recommend'}
        </button>
        {interest && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearInterest} title="Clear your saved interest">
            Clear
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setAskOpen((v) => !v)}
          aria-expanded={askOpen}
        >
          💬 Ask the AI
        </button>
      </div>
      {picks && picks.length > 0 && (
        <div className="ai-picks-list">
          {picks.slice(0, 4).map((p, i) => (
            <Link key={p.slug} href={`/s/${p.slug}`} className="ai-pick-row">
              <span className="ai-pick-rank" aria-hidden>{i + 1}</span>
              <span className="ai-pick-body">
                <strong>{p.name}</strong>
                <em>{p.reason}</em>
              </span>
              <span className="ai-pick-cta">Visit store →</span>
            </Link>
          ))}
        </div>
      )}
      {!busy && picks !== null && picks.length === 0 && (
        <p className="muted" style={{ fontSize: 13.5 }}>No matched stores yet — try a different interest.</p>
      )}

      {askOpen && (
        <div className="ai-ask">
          {askThread.length === 0 && (
            <p className="muted ai-ask-hint">
              Ask anything about the marketplace — prices, categories, who&apos;s near you. Answers come from real listings, and every suggestion links straight to the store.
            </p>
          )}
          <div className="ai-ask-thread" role="log" aria-live="polite">
            {askThread.map((m, i) => (
              <div key={i} className="ai-ask-turn">
                <p className="ai-ask-q"> You: {m.q}</p>
                <p className="ai-ask-a">✨ {m.reply}</p>
                {m.stores.length > 0 && (
                  <div className="ai-ask-stores">
                    {m.stores.map((s) => (
                      <Link key={s.slug} href={`/s/${s.slug}`} className="ai-ask-store">
                        🏪 {s.name}
                        <em>{s.category}</em>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {askBusy && <p className="muted ai-ask-turn">✨ Thinking…</p>}
            <div ref={askEndRef} />
          </div>
          <form
            className="ai-ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <input
              type="text"
              className="ai-picks-input"
              placeholder='e.g. “Who sells cakes in Lekki under ₦20,000?”'
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              maxLength={200}
              aria-label="Ask the AI a question"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={askBusy || !askInput.trim()}>
              Ask
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
