'use client';

// Paste-a-list bulk add: one product per line, "Name | price | stock".
// Calls the same /api/listings/create endpoint as the single-item form, one at a
// time, and reports per-line failures instead of failing the whole batch.

import { useState } from 'react';
import Link from 'next/link';

interface Parsed {
  line: number;
  title: string;
  priceNaira: number;
  stock: number;
}

function parseLines(raw: string): { rows: Parsed[]; errors: string[] } {
  const rows: Parsed[] = [];
  const errors: string[] = [];
  raw
    .split('\n')
    .map((l) => l.trim())
    .forEach((line, idx) => {
      if (!line) return;
      const parts = line.split('|').map((p) => p.trim());
      const [title, price, stock] = parts;
      if (!title || !price) {
        errors.push(`Line ${idx + 1}: use "Name | price | stock".`);
        return;
      }
      const priceNaira = Number(price.replace(/[₦,\s]/g, ''));
      if (!Number.isFinite(priceNaira) || priceNaira <= 0) {
        errors.push(`Line ${idx + 1}: "${price}" is not a price.`);
        return;
      }
      const stockNum = stock ? Number(stock) : 0;
      if (!Number.isFinite(stockNum) || stockNum < 0) {
        errors.push(`Line ${idx + 1}: "${stock}" is not a stock count.`);
        return;
      }
      rows.push({ line: idx + 1, title, priceNaira, stock: Math.round(stockNum) });
    });
  return { rows, errors };
}

export function BulkForm({ storeId }: { storeId: string }) {
  const [raw, setRaw] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [results, setResults] = useState<Array<{ title: string; ok: boolean; message?: string }>>([]);

  const { rows, errors } = parseLines(raw);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return;
    setState('saving');
    setResults([]);
    const out: Array<{ title: string; ok: boolean; message?: string }> = [];
    for (const row of rows) {
      try {
        const res = await fetch('/api/listings/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            storeId,
            type: 'product',
            title: row.title,
            description: '',
            priceKobo: Math.round(row.priceNaira * 100),
            stock: row.stock,
            imageUrls: [],
          }),
        });
        const json = (await res.json()) as { error?: { message?: string } };
        out.push({ title: row.title, ok: res.ok, message: res.ok ? undefined : json.error?.message });
      } catch {
        out.push({ title: row.title, ok: false, message: 'Network error' });
      }
    }
    setResults(out);
    setState('done');
  }

  const okCount = results.filter((r) => r.ok).length;

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <label htmlFor="bulk" style={{ fontSize: 14 }}>
        One product per line — <span className="mono">Name | price | stock</span>
      </label>
      <textarea
        id="bulk"
        className="input mono"
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'Ankara two-piece | 12000 | 4\nBeaded earrings | 3500 | 10\nSneakers (size 42) | 28000 | 1'}
        spellCheck={false}
      />
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        {rows.length} product{rows.length === 1 ? '' : 's'} ready. Photos and descriptions can be
        added after they are created.
      </p>
      {errors.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--danger, #b42318)', fontSize: 13 }}>
          {errors.slice(0, 5).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={state === 'saving' || rows.length === 0}>
          {state === 'saving' ? `Adding ${rows.length}…` : `Add ${rows.length || ''} products`}
        </button>
        <Link href="/dashboard/listings" className="btn btn-outline">
          Back to listings
        </Link>
      </div>

      {state === 'done' && (
        <div className="alert alert-success" role="status">
          <strong>{okCount} added{results.length - okCount > 0 ? `, ${results.length - okCount} failed` : ''}.</strong>
          {results.some((r) => !r.ok) && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {results.filter((r) => !r.ok).map((r) => (
                <li key={r.title}>
                  {r.title}: {r.message ?? 'failed'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
