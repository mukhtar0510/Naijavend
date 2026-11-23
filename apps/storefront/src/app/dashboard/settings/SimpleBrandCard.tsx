'use client';

// Logo and accent colour (default experience).
//
// Template and button style live in the Store designer above, which is the one
// place to pick them. This card used to have its own template and button
// pickers and always saved them, so saving a logo reset a designer-picked
// template (for example Aurora) back to Modern. It now saves only the logo and,
// when changed, the accent colour.
// Heavy per-section customisation lives behind FEATURES.storefrontCustomisation.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
}: {
  slug: string;
  initialLogoUrl: string | null;
  initialAccent: string;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '');
  const [accent, setAccent] = useState(initialAccent);
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
          ...(accent !== initialAccent ? { accentColor: accent, accentSoft: softAccent(accent) } : {}),
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
      <h2 style={{ fontSize: 18 }}>Logo and colour</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Your logo and your own accent colour. Pick the template and button style in the Store designer above.
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
