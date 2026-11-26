'use client';

// The seller's design editor (dashboard > Look & feel). Built to be understood
// at a glance: "Design my store with AI" at the top, then 1 Logo  2 Layout
// 3 Colours and buttons for sellers who prefer to pick each part,
// with a live preview of the seller's own store beside the steps and a single
// save bar that only appears when something changed. Layouts the plan can't
// publish are still previewable and say which plan unlocks them.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus, Lock, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { STORE_TEMPLATES, type StoreLayout } from '@idevtenancy/shared';
import { CATEGORY_OPTIONS, PRESETS, fontName, isDarkHex, type AiStyleResult } from '@/components/brand/StoreDesigner';

type ButtonShape = 'pill' | 'rounded' | 'square';
type HeroStyle = 'gradient' | 'image' | 'solid';

export interface StudioInitial {
  storeName: string;
  area: string | null;
  storeUrl: string;
  products: Array<{ name: string; price: string; image: string | null }>;
  logoUrl: string | null;
  layout: StoreLayout;
  accent: string;
  accentSoft: string;
  accentText: string;
  bg: string;
  /** Font family names, e.g. "Sora". */
  headingFont: string;
  bodyFont: string;
  heroStyle: HeroStyle;
  buttonShape: ButtonShape;
  /** First N templates the plan may publish; null = all. */
  templateLimit: number | null;
  planName: string;
}

interface Design {
  logoUrl: string | null;
  layout: StoreLayout;
  accent: string;
  accentSoft: string;
  accentText: string;
  bg: string;
  headingFont: string;
  bodyFont: string;
  heroStyle: HeroStyle;
  buttonShape: ButtonShape;
}

const ACCENTS = ['#1D4ED8', '#007A4A', '#A16207', '#BE1E6B', '#7C3AED', '#C2410C', '#0F766E', '#0B0C0E'];
const BACKGROUNDS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'warm', label: 'Warm', hex: '#FFFDF7' },
  { id: 'soft', label: 'Soft grey', hex: '#F6F7F9' },
  { id: 'dark', label: 'Dark', hex: '#0B0C0E' },
];
const SHAPES: Array<{ id: ButtonShape; label: string }> = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'pill', label: 'Pill' },
  { id: 'square', label: 'Square' },
];
const AI_IDEAS = ['Warm and elegant, gold accents', 'Clean and modern, green', 'Bold and bright for food', 'Soft pastel for cakes'];
const TIER_LABEL: Record<string, string> = { starter: 'Free', premium: 'Business', plus: 'Emirates Plus' };

/** Lighter tint of a hex colour, for hover and soft fills. */
function soften(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return `#${((1 << 24) + (mix((n >> 16) & 255) << 16) + (mix((n >> 8) & 255) << 8) + mix(n & 255)).toString(16).slice(1)}`;
}
/** Readable text on a colour: white on dark, near-black on light. */
function textOn(hex: string): string {
  return isDarkHex(hex) ? '#FFFFFF' : '#0B0C0E';
}

function fromInitial(i: StudioInitial): Design {
  return {
    logoUrl: i.logoUrl,
    layout: i.layout,
    accent: i.accent,
    accentSoft: i.accentSoft,
    accentText: i.accentText,
    bg: i.bg,
    headingFont: i.headingFont,
    bodyFont: i.bodyFont,
    heroStyle: i.heroStyle,
    buttonShape: i.buttonShape,
  };
}

export function DesignStudio({ initial }: { initial: StudioInitial }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Design>(() => fromInitial(initial));
  const [d, setD] = useState<Design>(() => fromInitial(initial));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [brief, setBrief] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'note'; text: string } | null>(null);

  const set = (patch: Partial<Design>) => setD((cur) => ({ ...cur, ...patch }));
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const dark = isDarkHex(d.bg);

  const tplIndex = STORE_TEMPLATES.findIndex((t) => t.id === d.layout);
  const tpl = STORE_TEMPLATES[tplIndex];
  const allowed = (i: number) => initial.templateLimit == null || i < initial.templateLimit;
  const layoutLocked = tplIndex >= 0 && !allowed(tplIndex);

  const groups = useMemo(() => {
    const yours = STORE_TEMPLATES.map((t, i) => ({ t, i })).filter(({ i }) => allowed(i));
    const locked = STORE_TEMPLATES.map((t, i) => ({ t, i })).filter(({ i }) => !allowed(i));
    return { yours, locked };
    // templateLimit is fixed for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadLogo(file: File) {
    setMessage(null);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return setMessage({ kind: 'error', text: 'Use a JPEG, PNG, WebP or GIF image.' });
    if (file.size > 5 * 1024 * 1024) return setMessage({ kind: 'error', text: 'The logo must be 5 MB or smaller.' });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/listings/upload-image', { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
      set({ logoUrl: body.url as string });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function pickAccent(hex: string) {
    set({ accent: hex, accentSoft: soften(hex), accentText: textOn(hex) });
  }

  function applyPreset(i: number) {
    const p = PRESETS[i]!;
    set({
      accent: p.theme.accent,
      accentSoft: p.theme.accentSoft,
      accentText: p.theme.accentText,
      bg: p.theme.bg,
      headingFont: fontName(p.theme.headingFont),
      bodyFont: fontName(p.theme.bodyFont),
      heroStyle: p.theme.heroStyle,
      buttonShape: p.theme.buttonShape,
    });
    setMessage({ kind: 'note', text: p.note });
  }

  async function askAi() {
    if (brief.trim().length < 3) return setMessage({ kind: 'error', text: 'Describe the feel first, for example "warm and elegant, gold accents".' });
    setAiBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ai/style-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, category }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? 'The AI designer is unavailable right now.');
      const s = body.style as AiStyleResult;
      set({
        layout: s.layout,
        accent: s.accent_color,
        accentSoft: s.accent_soft,
        accentText: s.accent_text,
        bg: s.background_color,
        headingFont: s.font_heading,
        bodyFont: s.font_body,
        heroStyle: s.hero_style,
        buttonShape: s.button_shape ?? 'rounded',
      });
      setMessage({ kind: 'note', text: `${s.note} Check the preview, then save.` });
    } catch (err) {
      setMessage({ kind: 'error', text: `${(err as Error).message} Try a ready-made look instead.` });
    } finally {
      setAiBusy(false);
    }
  }

  async function save() {
    if (layoutLocked) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: d.logoUrl,
          layout: d.layout,
          accentColor: d.accent,
          accentSoft: d.accentSoft,
          accentText: d.accentText,
          backgroundColor: d.bg,
          fontHeading: d.headingFont,
          fontBody: d.bodyFont,
          heroStyle: d.heroStyle,
          buttonShape: d.buttonShape,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save your design.');
      setSaved(d);
      setMessage({ kind: 'ok', text: 'Saved. Your store page now looks like the preview.' });
      router.refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const previewVars = {
    '--st-accent': d.accent,
    '--st-accent-soft': d.accentSoft,
    '--st-accent-text': d.accentText,
    '--st-bg': d.bg,
    '--st-font-heading': `'${d.headingFont}', 'Inter', sans-serif`,
    '--st-font-body': `'${d.bodyFont}', system-ui, sans-serif`,
    '--st-text': dark ? '#f4f4f5' : '#0b0c0e',
    '--st-heading': dark ? '#ffffff' : '#0b0c0e',
    '--st-muted': dark ? '#a1a1aa' : '#5a5f66',
    '--st-listing-bg': dark ? '#17181c' : '#ffffff',
  } as React.CSSProperties;

  const products = initial.products.length
    ? initial.products
    : [
        { name: 'Your first product', price: '₦5,000', image: null },
        { name: 'Another product', price: '₦12,500', image: null },
        { name: 'One more', price: '₦8,000', image: null },
      ];

  return (
    <div className="ds-grid">
      <div className="ds-steps">
        {/* --------------------------------------------------- AI, start here */}
        <section className="ds-ai-hero" aria-labelledby="ds-ai-title">
          <div className="ds-ai-hero-head">
            <span className="ds-ai-icon" aria-hidden>
              <Sparkles size={20} />
            </span>
            <div>
              <p className="ds-ai-kicker">Fastest way to start</p>
              <h2 id="ds-ai-title">Design my store with AI</h2>
              <p>
                Say how your store should feel. The AI picks a layout, colours and fonts, and you see it in the preview straight
                away. Nothing changes on your store until you press Save.
              </p>
            </div>
          </div>
          <div className="ds-ai-row">
            <input
              type="text"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void askAi();
                }
              }}
              maxLength={200}
              placeholder="e.g. warm and elegant, gold accents"
              aria-label="Describe the feel you want"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="What you sell">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="ds-ai-go" onClick={askAi} disabled={aiBusy}>
              {aiBusy ? <Loader2 size={16} className="ds-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
              {aiBusy ? 'Designing…' : 'Design it'}
            </button>
          </div>
          <div className="ds-ai-ideas" aria-label="Ideas to try">
            <span>Try:</span>
            {AI_IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setBrief(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </section>

        <p className="ds-or">Or set it up yourself, step by step</p>

        {/* ------------------------------------------------------------- 1 */}
        <section className="ds-card" aria-labelledby="ds-logo-title">
          <div className="ds-step-head">
            <span className="ds-step-num" aria-hidden>1</span>
            <div>
              <h2 id="ds-logo-title">Logo</h2>
              <p>A square image works best. It shows at the top of your store and in search.</p>
            </div>
          </div>
          <div className="ds-logo-row">
            <span className="ds-logo-box">
              {d.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller upload
                <img src={d.logoUrl} alt="Your logo" />
              ) : (
                <span aria-hidden>{initial.storeName.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <label className="btn btn-outline btn-sm ds-upload">
              {uploading ? <Loader2 size={15} className="ds-spin" aria-hidden /> : <ImagePlus size={15} aria-hidden />}
              {d.logoUrl ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = '';
                }}
              />
            </label>
            {d.logoUrl && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ logoUrl: null })}>
                <Trash2 size={15} aria-hidden /> Remove
              </button>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------- 2 */}
        <section className="ds-card" aria-labelledby="ds-layout-title">
          <div className="ds-step-head">
            <span className="ds-step-num" aria-hidden>2</span>
            <div>
              <h2 id="ds-layout-title">Layout</h2>
              <p>The shape of your page. Your photos, products and colours stay the same.</p>
            </div>
          </div>
          <p className="ds-group-label">On your {initial.planName} plan</p>
          <div className="ds-tpl-grid" role="radiogroup" aria-label="Layouts on your plan">
            {groups.yours.map(({ t }) => (
              <TemplateTile key={t.id} id={t.id} name={t.name} bestFor={t.bestFor} active={d.layout === t.id} onPick={() => set({ layout: t.id })} />
            ))}
          </div>
          {groups.locked.length > 0 && (
            <>
              <p className="ds-group-label">
                <Lock size={12} aria-hidden /> Preview only: upgrade to publish
              </p>
              <div className="ds-tpl-grid" role="radiogroup" aria-label="Layouts on other plans">
                {groups.locked.map(({ t }) => (
                  <TemplateTile
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    bestFor={t.bestFor}
                    active={d.layout === t.id}
                    tier={TIER_LABEL[t.tier ?? 'starter']}
                    onPick={() => set({ layout: t.id })}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* ------------------------------------------------------------- 3 */}
        <section className="ds-card" aria-labelledby="ds-colour-title">
          <div className="ds-step-head">
            <span className="ds-step-num" aria-hidden>3</span>
            <div>
              <h2 id="ds-colour-title">Colours and buttons</h2>
              <p>Start from a ready-made look, or pick each part yourself.</p>
            </div>
          </div>

          <p className="ds-group-label">Ready-made looks</p>
          <div className="ds-presets">
            {PRESETS.map((p, i) => (
              <button key={p.label} type="button" className="ds-preset" onClick={() => applyPreset(i)}>
                <span className="ds-preset-swatch" style={{ background: p.theme.bg }} aria-hidden>
                  <i style={{ background: p.theme.accent }} />
                </span>
                {p.label}
              </button>
            ))}
          </div>

          <p className="ds-group-label">Main colour</p>
          <div className="ds-swatches" role="radiogroup" aria-label="Main colour">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={d.accent.toLowerCase() === c.toLowerCase()}
                aria-label={`Use ${c}`}
                className="ds-swatch"
                style={{ background: c }}
                onClick={() => pickAccent(c)}
              >
                {d.accent.toLowerCase() === c.toLowerCase() && <Check size={14} color={textOn(c)} aria-hidden />}
              </button>
            ))}
            <label className="ds-swatch ds-swatch-custom" title="Pick any colour">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : '#1d4ed8'} onChange={(e) => pickAccent(e.target.value.toUpperCase())} aria-label="Custom main colour" />
            </label>
          </div>

          <p className="ds-group-label">Page background</p>
          <div className="ds-chips" role="radiogroup" aria-label="Page background">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={d.bg.toUpperCase() === b.hex}
                className={`ds-chip${d.bg.toUpperCase() === b.hex ? ' on' : ''}`}
                onClick={() => set({ bg: b.hex })}
              >
                <span className="ds-chip-dot" style={{ background: b.hex }} aria-hidden /> {b.label}
              </button>
            ))}
          </div>

          <p className="ds-group-label">Buttons</p>
          <div className="ds-chips" role="radiogroup" aria-label="Button shape">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={d.buttonShape === s.id}
                className={`ds-chip${d.buttonShape === s.id ? ' on' : ''}`}
                onClick={() => set({ buttonShape: s.id })}
              >
                <span className={`ds-shape ds-shape-${s.id}`} aria-hidden /> {s.label}
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* --------------------------------------------------------- preview */}
      <aside className="ds-preview" aria-label="Live preview of your store">
        <div className="ds-preview-head">
          <strong>Live preview</strong>
          <span>
            {tpl?.name ?? 'Modern'} layout{dirty ? ' · not saved yet' : ''}
          </span>
        </div>
        <div className="sdg-browser">
          <div className="sdg-browser-bar">
            <span className="sdg-browser-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="sdg-browser-url">{initial.storeUrl.replace(/^https?:\/\//, '')}</span>
          </div>
          <div
            className="site-shell sdg-page is-compact"
            data-layout={d.layout}
            data-hero-bg={d.heroStyle === 'solid' ? 'true' : undefined}
            data-buttons={d.buttonShape}
            style={previewVars}
          >
            <div className="sdg-masthead">
              <span className="sdg-brand ds-brand">
                {d.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- seller upload
                  <img src={d.logoUrl} alt="" />
                )}
                {initial.storeName}
              </span>
              <span className="sdg-masthead-links" aria-hidden>
                <i>Shop</i>
                <i>Chat</i>
              </span>
            </div>
            <div className={`page-hero sdg-hero${d.heroStyle === 'gradient' ? ' is-gradient' : ''}`}>
              {initial.area && <span className="sdg-hero-badge">{initial.area}</span>}
              <h3>{initial.storeName}</h3>
              <p>Order on WhatsApp or here, pay the seller directly.</p>
              <div className="sdg-hero-ctas">
                <span className="btn btn-primary btn-sm">Browse catalogue</span>
                <span className="sdg-ghost-btn">Chat</span>
              </div>
            </div>
            <div className="sdg-products">
              {products.slice(0, 3).map((p) => (
                <div key={p.name} className="sdg-product">
                  <span className="sdg-product-thumb" aria-hidden>
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- seller upload
                      <img src={p.image} alt="" />
                    )}
                  </span>
                  <strong>{p.name}</strong>
                  <span className="price">{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {tpl?.bestFor && <p className="ds-preview-note">Good for {tpl.bestFor.toLowerCase()}.</p>}
      </aside>

      {/* ------------------------------------------------------------ save */}
      {(dirty || message) && (
        <div className={`ds-savebar${dirty ? ' is-dirty' : ''}`} role="status">
          <div className="ds-savebar-text">
            {layoutLocked ? (
              <span className="ds-msg-error">
                <Lock size={14} aria-hidden /> {tpl?.name} is on {TIER_LABEL[tpl?.tier ?? 'premium']}. Pick a layout on your plan or{' '}
                <Link href="/dashboard/plan">upgrade</Link> to publish it.
              </span>
            ) : message ? (
              <span className={message.kind === 'error' ? 'ds-msg-error' : message.kind === 'ok' ? 'ds-msg-ok' : ''}>
                {message.kind === 'ok' && <Check size={14} aria-hidden />} {message.text}
              </span>
            ) : (
              <span>You have unsaved changes.</span>
            )}
          </div>
          {dirty && (
            <div className="ds-savebar-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setD(saved); setMessage(null); }} disabled={saving}>
                <RotateCcw size={14} aria-hidden /> Undo
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || uploading || layoutLocked}>
                {saving ? 'Saving…' : 'Save design'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateTile({
  id,
  name,
  bestFor,
  active,
  tier,
  onPick,
}: {
  id: StoreLayout;
  name: string;
  bestFor: string;
  active: boolean;
  tier?: string;
  onPick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={active} className={`ds-tpl${active ? ' on' : ''}`} onClick={onPick} title={`Best for ${bestFor.toLowerCase()}`}>
      <span className={`sdg-thumb sdg-${id}`} aria-hidden>
        <span className="sdg-thumb-nav" />
        <span className="sdg-thumb-hero" />
        <span className="sdg-thumb-row">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="ds-tpl-name">
        {name}
        {active && <Check size={13} aria-hidden />}
      </span>
      {tier && (
        <span className="ds-tpl-tier">
          <Lock size={10} aria-hidden /> {tier}
        </span>
      )}
    </button>
  );
}
