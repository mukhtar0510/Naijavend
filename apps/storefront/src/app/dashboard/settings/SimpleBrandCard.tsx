'use client';

// Simple store-brand editor (default experience).
//
// Heavy per-section customisation lives behind FEATURES.storefrontCustomisation.
// What every seller gets: a logo, an accent colour and one of five structural
// templates. That covers the branding a buyer actually notices without a
// twenty-control panel.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STORE_TEMPLATES, type StoreLayout } from '@idevtenancy/shared';

const TEMPLATE_IDS: StoreLayout[] = ['modern', 'boutique', 'bold', 'minimal', 'merchant'];
const ACCENTS = ['#1D4ED8', '#0F766E', '#BE1E6B', '#B45309', '#7C3AED', '#0B0C0E'];

/** Mix a hex colour toward white — used for the softer accent tint. */
function softAccent(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function SimpleBrandCard({
  slug,
  initialLogoUrl,
  initialAccent,
  initialLayout,
}: {
  slug: string;
  initialLogoUrl: string | null;
  initialAccent: string;
  initialLayout: StoreLayout;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '');
  const [accent, setAccent] = useState(initialAccent);
  const [layout, setLayout] = useState<StoreLayout>(
    TEMPLATE_IDS.includes(initialLayout) ? initialLayout : 'modern'
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setMessage(null);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError('Images must be JPEG, PNG, WebP or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/listings/upload-image', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
      setLogoUrl(body.url as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
          accentColor: accent,
          accentSoft: softAccent(accent),
          layout,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save branding.');
      setMessage('Branding saved — your store site is updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18 }}>Store branding</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Three things buyers notice: your logo, your accent colour and how the page is laid out.
      </p>

      <div className="field">
        <label htmlFor="brand-logo">Logo</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller upload
            <img
              src={logoUrl}
              alt=""
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }}
            />
          ) : null}
          <input
            id="brand-logo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {logoUrl ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setLogoUrl('')}>
              Remove
            </button>
          ) : null}
        </div>
        {uploading ? <p className="hint">Uploading…</p> : null}
      </div>

      <div className="field">
        <label>Accent colour</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use ${c}`}
              aria-pressed={accent.toLowerCase() === c.toLowerCase()}
              onClick={() => setAccent(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: c,
                border: accent.toLowerCase() === c.toLowerCase() ? '3px solid var(--text)' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            />
          ))}
          <input
            type="color"
            aria-label="Custom accent colour"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            style={{ width: 44, height: 36, padding: 2, borderRadius: 8 }}
          />
        </div>
      </div>

      <div className="field">
        <label>Template</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {STORE_TEMPLATES.filter((t) => TEMPLATE_IDS.includes(t.id)).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLayout(t.id)}
              aria-pressed={layout === t.id}
              style={{
                textAlign: 'left',
                padding: 12,
                borderRadius: 12,
                border: layout === t.id ? '2px solid var(--blue)' : '1px solid var(--border)',
                background: layout === t.id ? 'var(--blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <strong style={{ display: 'block', fontSize: 14 }}>{t.name}</strong>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {t.tagline}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading}>
        {busy ? 'Saving…' : 'Save branding'}
      </button>
      <p className="hint" style={{ marginTop: 8 }}>
        Your store link stays <strong>/s/{slug}</strong>.
      </p>
    </div>
  );
}
