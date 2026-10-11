'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Pick {
  kind: string;
  slug: string;
  name: string;
  reason: string;
}

// Buyer-facing "AI picks for you" on Discover. Fully customizable: the shopper
// types their own interest (renameable at any moment) and can re-run the picks;
// their interest is remembered locally so the next visit reuses it until THEY
// change it. Uses the viewer's saved location so proximity feeds the ranking.
export function AiPickRow() {
  const [interest, setInterest] = useState('');
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [source, setSource] = useState<string>('fallback');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Restore the shopper's own interest label (they can rename it freely).
    setInterest(window.localStorage.getItem('nv-ai-interest') ?? '');
    // Restore saved viewer location for distance-aware picks.
    let loc: { lat: number; lng: number; label?: string } | null = null;
    try {
      const raw = window.localStorage.getItem('sf-loc');
      if (raw) loc = JSON.parse(raw);
    } catch {
      // no saved location
    }
    void run((window.localStorage.getItem('nv-ai-interest') ?? ''), loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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

  function readLoc(): { lat: number; lng: number; label?: string } | null {
    try {
      const raw = window.localStorage.getItem('sf-loc');
      return raw ? (JSON.parse(raw) as { lat: number; lng: number; label?: string }) : null;
    } catch {
      return null;
    }
  }

  return (
    <section className="ai-picks" aria-label="AI-picked stores for you">
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
              <span className="ai-pick-go" aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}
      {!busy && picks !== null && picks.length === 0 && (
        <p className="muted" style={{ fontSize: 13.5 }}>No matched stores yet — try a different interest.</p>
      )}
    </section>
  );
}
