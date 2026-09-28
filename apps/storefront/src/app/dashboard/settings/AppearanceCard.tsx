'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stars } from '@/components/Stars';
import { STORE_TEMPLATES, categoryEmoji, categoryLabel } from '@idevtenancy/shared';
import type { AiStyleDraft, StoreTheme } from '@idevtenancy/shared';

const FONTS = ['Sora', 'Inter', 'Playfair Display', 'DM Sans', 'Space Grotesk'] as const;
const HERO_STYLES = ['gradient', 'image', 'solid'] as const;

const PRESET_ACCENTS = [
  '#1D4ED8', // Naijavend blue
  '#0B0C0E', // black
  '#BE1E6B', // rose
  '#B4430C', // terracotta
  '#166534', // green
  '#0E7490', // teal
  '#7C3AED', // violet
  '#8A6A1F', // gold
];

// Upload-backed image field: pick a file → upload to the seller's own RLS folder in
// the `store-media` bucket → preview with a remove button. No more pasting URLs.
function ImageUploadField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `up-${id}`;

  async function upload(file: File) {
    setError(null);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError('Images must be JPEG, PNG, WebP or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/listings/upload-image', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
      onChange(body.url as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {value ? (
          <span
            style={{
              width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)',
              overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--elevated)', flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
            <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
        ) : (
          <span
            aria-hidden
            style={{
              width: 64, height: 64, borderRadius: 12, border: '1px dashed var(--border-strong)',
              display: 'grid', placeItems: 'center', fontSize: 22, background: 'var(--elevated)', flexShrink: 0,
            }}
          >
            🖼️
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn btn-outline btn-sm" htmlFor={inputId} style={{ cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          </label>
          {value && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </div>
      {error ? <p className="field-error">{error}</p> : <p className="hint">{hint}</p>}
    </div>
  );
}

interface AiStyleResult {
  accent_color: string;
  accent_soft: string;
  accent_text: string;
  font_heading: string;
  font_body: string;
  layout: 'modern' | 'classic' | 'bold';
  hero_style: 'gradient' | 'image' | 'solid';
  background_color: string;
  text_color?: string | null;
  heading_color?: string | null;
  muted_color?: string | null;
  note: string;
}

// Same dark-background heuristic the AI stylist uses server-side: on a dark
// theme we must drop hand-picked (light-ink) text colours so text stays readable.
function isDarkHex(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

export function AppearanceCard({
  slug,
  storeName,
  category,
  businessType,
  initialTheme,
}: {
  slug: string;
  storeName: string;
  category: string;
  businessType: string;
  initialTheme: StoreTheme;
}) {
  const router = useRouter();
  const [state, setState] = useState<StoreTheme>(initialTheme);
  const [brief, setBrief] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof StoreTheme>(key: K, value: StoreTheme[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const dirty = JSON.stringify(state) !== JSON.stringify(initialTheme);

  async function suggestWithAi() {
    if (!brief.trim()) {
      setError('Describe the look you want first (e.g. "elegant and minimal, soft pink accents").');
      return;
    }
    setAiBusy(true);
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch('/api/ai/style-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'AI styling failed.');
      const style = body.style as AiStyleResult;
      setState((s) => ({
        ...s,
        accent_color: style.accent_color,
        accent_soft: style.accent_soft,
        accent_text: style.accent_text,
        font_heading: style.font_heading,
        font_body: style.font_body,
        layout: style.layout,
        hero_style: style.hero_style,
        background_color: style.background_color,
        // Dark presets ship matching text colours — required for readability.
        // Light presets DON'T send colours: keep whatever the seller picked by
        // hand instead of wiping their custom text/heading choices.
        text_color: style.text_color ?? (isDarkHex(style.background_color) ? null : s.text_color),
        heading_color: style.heading_color ?? (isDarkHex(style.background_color) ? null : s.heading_color),
        muted_color: style.muted_color ?? (isDarkHex(style.background_color) ? null : s.muted_color),
      }));
      setAiNote(style.note);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(false);
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
          accentColor: state.accent_color,
          accentSoft: state.accent_soft,
          accentText: state.accent_text,
          backgroundColor: state.background_color,
          fontHeading: state.font_heading,
          fontBody: state.font_body,
          layout: state.layout,
          heroStyle: state.hero_style,
          bannerUrl: state.banner_url,
          faviconUrl: state.favicon_url,
          logoUrl: state.logo_url,
          subheaderUrl: state.subheader_url,
          textColor: state.text_color,
          headingColor: state.heading_color,
          mutedColor: state.muted_color,
          buttonShape: state.button_shape,
          cardStyle: state.card_style,
          listingColor: state.listing_color,
          listingBgColor: state.listing_bg_color,
          cardRadius: state.card_radius,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save appearance.');
      setMessage('Appearance saved — your store site is updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Live preview uses the exact same CSS variables the real store site consumes.
  const previewStyle = {
    '--st-accent': state.accent_color,
    '--st-accent-soft': state.accent_soft,
    '--st-accent-text': state.accent_text,
    '--st-bg': state.background_color,
    '--st-font-heading': `'${state.font_heading}', 'Inter', sans-serif`,
    '--st-font-body': `'${state.font_body}', system-ui, sans-serif`,
    ...(state.text_color ? { '--st-text': state.text_color } : {}),
    ...(state.heading_color ? { '--st-heading': state.heading_color } : {}),
    ...(state.muted_color ? { '--st-muted': state.muted_color } : {}),
    ...(state.listing_bg_color ? { '--st-listing-bg': state.listing_bg_color } : {}),
    ...(state.listing_color ? { '--st-listing-text': state.listing_color, '--st-listing-heading': state.listing_color } : {}),
  } as React.CSSProperties;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18 }}>Appearance</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        Customise your public store site (/{slug}). Changes apply live once you save.
      </p>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* AI stylist */}
      <div className="card card-elevated" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15.5 }}>✨ Let AI style your store</h3>
        <div className="field" style={{ marginBottom: 10 }}>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={600}
            placeholder={'Describe the vibe: "elegant boutique for handmade jewellery, dark and premium, gold accents" or "bright and playful cake studio"'}
            rows={2}
          />
        </div>
        <button type="button" className="btn btn-black" onClick={suggestWithAi} disabled={aiBusy}>
          {aiBusy ? 'Styling…' : 'Suggest a style'}
        </button>
        {aiNote && (
          <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
            {aiNote} — tweak anything below, then save.
          </p>
        )}
      </div>

      {/* Live preview */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Live preview</p>
        <div className="site-shell" data-layout={state.layout} data-card-radius={state.card_radius === 'sharp' ? 'sharp' : 'rounded'} style={previewStyle}>
          <div className="page-hero" style={state.hero_style === 'image' && state.banner_url ? { backgroundImage: `url('${state.banner_url}')` } : undefined}>
            <div style={{ padding: '20px 20px 24px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                {state.logo_url ? (
                  <img className="store-hero-logo" src={state.logo_url} alt="" style={{ width: 56, height: 56 }} />
                ) : (
                  <div className="ring-3d" style={{ width: 56, height: 56, borderRadius: 999 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 999, background: 'var(--surface)' }} />
                  </div>
                )}
                <div>
                  <strong style={{ fontFamily: 'var(--st-font-heading)', fontSize: 18 }}>{storeName}</strong>
                  <div><Stars value={4.5} showNumeric={false} /></div>
                </div>
              </div>
              <span className="badge badge-blue">{categoryEmoji(category)} {categoryLabel(category)}</span>{' '}
              <span className="badge">{businessType}</span>
              <p className="muted" style={{ margin: '10px 0 0', fontSize: 14 }}>
                Preview — this is how your hero and buttons will look.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <span className="btn btn-primary btn-sm">Chat on WhatsApp</span>
                <span className="btn btn-outline btn-sm">Get directions</span>
              </div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <div className="listing-grid" data-buttons={state.button_shape} data-cards={state.card_style}>
              <div className="card listing-card tilt-card">
                <h3 style={{ fontSize: 15, margin: 0 }}>Knotless braids</h3>
                <span className="price">₦15,000</span>
              </div>
              <div className="card listing-card tilt-card">
                <h3 style={{ fontSize: 15, margin: 0 }}>Gele tying</h3>
                <span className="price">₦8,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Colours */}
      <div className="field">
        <label>Accent colour (buttons, links, prices)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESET_ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              onClick={() => set('accent_color', c)}
              style={{
                width: 34, height: 34, borderRadius: 999, border:
                  state.accent_color.toLowerCase() === c.toLowerCase() ? '3px solid var(--text)' : '1px solid var(--border)',
                background: c, cursor: 'pointer', padding: 0,
              }}
            />
          ))}
          <input
            type="color"
            value={state.accent_color}
            onChange={(e) => set('accent_color', e.target.value)}
            aria-label="Custom accent colour"
            style={{ width: 44, height: 34, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="bg">Page background</label>
          <input id="bg" type="color" value={state.background_color} onChange={(e) => set('background_color', e.target.value)} style={{ width: '100%', height: 40, padding: 4 }} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="atext">Button text colour</label>
          <input id="atext" type="color" value={state.accent_text} onChange={(e) => set('accent_text', e.target.value)} style={{ width: '100%', height: 40, padding: 4 }} />
        </div>
      </div>

      {/* Text colours */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="tc">Text colour <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              id="tc"
              type="color"
              value={state.text_color ?? '#0B0C0E'}
              onChange={(e) => set('text_color', e.target.value)}
              style={{ width: 52, height: 40, padding: 4 }}
            />
            {state.text_color && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set('text_color', null)}>
                Default
              </button>
            )}
          </div>
          <p className="hint">All body text on your site. Leave unset for the standard dark ink.</p>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="hc">Heading colour <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              id="hc"
              type="color"
              value={state.heading_color ?? state.text_color ?? '#0B0C0E'}
              onChange={(e) => set('heading_color', e.target.value)}
              style={{ width: 52, height: 40, padding: 4 }}
            />
            {state.heading_color && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set('heading_color', null)}>
                Default
              </button>
            )}
          </div>
          <p className="hint">Titles and section headers only — great for a two-tone brand look.</p>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="mc">Secondary text <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              id="mc"
              type="color"
              value={state.muted_color ?? '#5A5F66'}
              onChange={(e) => set('muted_color', e.target.value)}
              style={{ width: 52, height: 40, padding: 4 }}
            />
            {state.muted_color && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set('muted_color', null)}>
                Default
              </button>
            )}
          </div>
          <p className="hint">Addresses, hints and captions — the quieter text.</p>
        </div>
      </div>

      {/* Button shape + card style */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Button shape</label>
          <div className="admin-role-tabs" role="radiogroup" aria-label="Button shape">
            {(['pill', 'rounded', 'square'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={state.button_shape === s}
                className={`btn btn-outline btn-sm${state.button_shape === s ? ' is-active' : ''}`}
                style={
                  s === 'pill' ? { borderRadius: 999 } : s === 'square' ? { borderRadius: 2 } : undefined
                }
                onClick={() => set('button_shape', s)}
              >
                {s === 'pill' ? '〇 Pill' : s === 'rounded' ? '▢ Rounded' : 'Square'}
              </button>
            ))
            }
          </div>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Card style</label>
          <div className="admin-role-tabs" role="radiogroup" aria-label="Card style">
            {(['soft', 'outline', 'shadow'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={state.card_style === c}
                className={`btn btn-outline btn-sm${state.card_style === c ? ' is-active' : ''}`}
                onClick={() => set('card_style', c)}
              >
                {c === 'soft' ? 'Soft' : c === 'outline' ? 'Outline' : 'Floating'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listing-card colours + corner radius */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="lbg">Listings background <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              id="lbg"
              type="color"
              value={state.listing_bg_color ?? '#FFFFFF'}
              onChange={(e) => set('listing_bg_color', e.target.value)}
              style={{ width: 52, height: 40, padding: 4 }}
            />
            {state.listing_bg_color && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set('listing_bg_color', null)}>
                Default
              </button>
            )}
          </div>
          <p className="hint">The surface behind each product/service card on your site.</p>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="ltxt">Listings text <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              id="ltxt"
              type="color"
              value={state.listing_color ?? '#0B0C0E'}
              onChange={(e) => set('listing_color', e.target.value)}
              style={{ width: 52, height: 40, padding: 4 }}
            />
            {state.listing_color && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set('listing_color', null)}>
                Default
              </button>
            )}
          </div>
          <p className="hint">Product titles and descriptions inside the cards only.</p>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Listings corners</label>
          <div className="admin-role-tabs" role="radiogroup" aria-label="Listing card corners">
            {(['rounded', 'sharp'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={(state.card_radius ?? 'rounded') === r}
                className={`btn btn-outline btn-sm${(state.card_radius ?? 'rounded') === r ? ' is-active' : ''}`}
                style={r === 'sharp' ? { borderRadius: 2 } : { borderRadius: 12 }}
                onClick={() => set('card_radius', r)}
              >
                {r === 'rounded' ? '◕ Rounded' : '▢ Sharp'}
              </button>
            ))}
          </div>
          <p className="hint">Round corners (the default) or square edges on every listing card.</p>
        </div>
      </div>

      {/* Fonts */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="fh">Heading font</label>
          <select id="fh" value={state.font_heading} onChange={(e) => set('font_heading', e.target.value)}>
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="fb">Body font</label>
          <select id="fb" value={state.font_body} onChange={(e) => set('font_body', e.target.value)}>
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Template — changes the site's structure, not just colours */}
      <div className="field">
        <label>Template</label>
        <div className="tpl-grid" role="radiogroup" aria-label="Store template">
          {STORE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={state.layout === t.id}
              className={`tpl-card${state.layout === t.id ? ' is-active' : ''}`}
              onClick={() => set('layout', t.id)}
            >
              <span className={`tpl-thumb tpl-${t.id}`} aria-hidden>
                <span className="tpl-thumb-nav" />
                <span className="tpl-thumb-hero" />
                <span className="tpl-thumb-row"><i /><i /><i /></span>
              </span>
              <strong>{t.name}</strong>
              <span className="tpl-tagline">{t.tagline}</span>
              <span className="tpl-best">Best for: {t.bestFor}</span>
            </button>
          ))}
        </div>
        <p className="hint">Templates change your site&apos;s structure — header, product grid and footer — while keeping your colours, fonts and images.</p>
      </div>

      {/* Hero style */}
      <div className="field">
        <label htmlFor="hero">Hero style</label>
        <select id="hero" value={state.hero_style} onChange={(e) => set('hero_style', e.target.value as StoreTheme['hero_style'])}>
          {HERO_STYLES.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <p className="hint">"Image" uses your banner picture behind the header.</p>
      </div>

      {/* Images — all uploads, no URLs */}
      <ImageUploadField
        id="logo"
        label="Logo / big seller icon"
        hint="Shown big in the hero with a 3D ring — this is your store's face."
        value={state.logo_url}
        onChange={(url) => set('logo_url', url)}
      />
      <ImageUploadField
        id="favicon"
        label="Favicon"
        hint="Browser-tab icon; also used as the masthead icon if no logo is set."
        value={state.favicon_url}
        onChange={(url) => set('favicon_url', url)}
      />
      <ImageUploadField
        id="banner"
        label="Banner image"
        hint="Hero backdrop when hero style is 'image'."
        value={state.banner_url}
        onChange={(url) => set('banner_url', url)}
      />
      <ImageUploadField
        id="subheader"
        label="Sub-header picture"
        hint="A wide picture strip between the hero and your listings."
        value={state.subheader_url}
        onChange={(url) => set('subheader_url', url)}
      />

      <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
        {busy ? 'Saving…' : 'Save appearance'}
      </button>
    </div>
  );
}
