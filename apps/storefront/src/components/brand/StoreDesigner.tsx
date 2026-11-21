'use client';

// Public storefront designer: the "preview like before" surface from the
// marketing pages. Two panels in one section —
//   1. the template gallery (all 20 layouts, 7 marked as Starter),
//   2. the AI theme designer, which turns a one-line vibe brief into colours,
//      fonts and a layout for the live preview.
// Everything here is illustrative: it never reads or writes a real store.

import { useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, Wand2 } from 'lucide-react';
import {
  STORE_TEMPLATES,
  STARTER_TEMPLATE_COUNT,
  type StoreLayout,
} from '@idevtenancy/shared';

type Filter = 'starter' | 'all';

interface ThemeState {
  accent: string;
  accentText: string;
  accentSoft: string;
  bg: string;
  headingFont: string;
  bodyFont: string;
  heroStyle: 'gradient' | 'image' | 'solid';
  dark: boolean;
}

const DEFAULT_THEME: ThemeState = {
  accent: '#a16207',
  accentSoft: '#ca8a04',
  accentText: '#ffffff',
  bg: '#ffffff',
  headingFont: "'Sora', 'Inter', sans-serif",
  bodyFont: "'Inter', system-ui, sans-serif",
  heroStyle: 'gradient',
  dark: false,
};

// Keyless-safe presets. They use the same shape the AI returns, so the preview
// behaves identically whether the model answers or these are picked by hand.
const PRESETS: Array<{ label: string; theme: ThemeState; note: string }> = [
  {
    label: 'Gold & calm',
    theme: {
      accent: '#a16207', accentSoft: '#ca8a04', accentText: '#ffffff',
      bg: '#fffdf7', headingFont: "'Playfair Display', serif",
      bodyFont: "'Inter', system-ui, sans-serif", heroStyle: 'gradient', dark: false,
    },
    note: 'Warm parchment page, gold buttons, serif headlines — premium but friendly.',
  },
  {
    label: 'Naija green',
    theme: {
      accent: '#007a4a', accentSoft: '#0f9d63', accentText: '#ffffff',
      bg: '#ffffff', headingFont: "'Sora', 'Inter', sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif", heroStyle: 'solid', dark: false,
    },
    note: 'Clean white storefront with Naija green calls to action.',
  },
  {
    label: 'Midnight',
    theme: {
      accent: '#e0a106', accentSoft: '#f3bb2f', accentText: '#0b0c0e',
      bg: '#0b0c0e', headingFont: "'Space Grotesk', sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif", heroStyle: 'gradient', dark: true,
    },
    note: 'Dark stage, glowing gold accents — night-market energy.',
  },
  {
    label: 'Pastel bakery',
    theme: {
      accent: '#be1e6b', accentSoft: '#e8558e', accentText: '#ffffff',
      bg: '#fff7fa', headingFont: "'Fraunces', serif",
      bodyFont: "'DM Sans', system-ui, sans-serif", heroStyle: 'gradient', dark: false,
    },
    note: 'Soft pink wash with rounded cards — good for cakes and gifts.',
  },
];

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General store' },
  { value: 'fashion', label: 'Fashion & tailoring' },
  { value: 'beauty', label: 'Beauty & hair' },
  { value: 'food', label: 'Food & catering' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'crafts', label: 'Crafts & décor' },
  { value: 'home-services', label: 'Home services' },
] as const;

interface AiStyleResult {
  accent_color: string;
  accent_soft: string;
  accent_text: string;
  font_heading: string;
  font_body: string;
  layout: StoreLayout;
  hero_style: 'gradient' | 'image' | 'solid';
  background_color: string;
  text_color?: string | null;
  note: string;
}

function isDarkHex(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

export function StoreDesigner({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>('starter');
  const [template, setTemplate] = useState<StoreLayout>('modern');
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [brief, setBrief] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = useMemo(
    () => (filter === 'starter' ? STORE_TEMPLATES.slice(0, STARTER_TEMPLATE_COUNT) : STORE_TEMPLATES),
    [filter],
  );

  const active = STORE_TEMPLATES.find((t) => t.id === template);

  function applyTheme(next: ThemeState, message: string) {
    setTheme(next);
    setNote(message);
  }

  async function designWithAi() {
    if (!brief.trim()) {
      setError('Describe the vibe first — for example "warm and elegant, gold accents".');
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/ai/style-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, category }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? 'The AI designer is unavailable right now.');
      const style = body.style as AiStyleResult;
      setTemplate(style.layout);
      setTheme({
        accent: style.accent_color,
        accentSoft: style.accent_soft,
        accentText: style.accent_text,
        bg: style.background_color,
        headingFont: `'${style.font_heading}', serif`,
        bodyFont: `'${style.font_body}', system-ui, sans-serif`,
        heroStyle: style.hero_style,
        dark: isDarkHex(style.background_color),
      });
      setNote(style.note);
    } catch (err) {
      setError(`${(err as Error).message} Try one of the preset looks below instead.`);
    } finally {
      setBusy(false);
    }
  }

  const previewVars = {
    '--st-accent': theme.accent,
    '--st-accent-soft': theme.accentSoft,
    '--st-accent-text': theme.accentText,
    '--st-bg': theme.bg,
    '--st-font-heading': theme.headingFont,
    '--st-font-body': theme.bodyFont,
    '--st-text': theme.dark ? '#f4f4f5' : '#0b0c0e',
    '--st-heading': theme.dark ? '#ffffff' : '#0b0c0e',
    '--st-muted': theme.dark ? '#a1a1aa' : '#5a5f66',
    '--st-listing-bg': theme.dark ? '#17181c' : '#ffffff',
  } as React.CSSProperties;

  return (
    <div className="sdg">
      <div className="sdg-controls">
        {/* ------------------------------ templates ------------------------- */}
        <div className="sdg-block">
          <div className="sdg-block-head">
            <div>
              <h3>Pick a template</h3>
              <p>
                {filter === 'starter'
                  ? `The ${STARTER_TEMPLATE_COUNT} templates on every plan, including Free.`
                  : `All ${STORE_TEMPLATES.length} templates. The first ${STARTER_TEMPLATE_COUNT} are on Free.`}
              </p>
            </div>
            <div className="sdg-tabs" role="radiogroup" aria-label="Template set">
              <button
                type="button"
                role="radio"
                aria-checked={filter === 'starter'}
                className={`sdg-tab${filter === 'starter' ? ' is-active' : ''}`}
                onClick={() => setFilter('starter')}
              >
                Starter · {STARTER_TEMPLATE_COUNT}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={filter === 'all'}
                className={`sdg-tab${filter === 'all' ? ' is-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All · {STORE_TEMPLATES.length}
              </button>
            </div>
          </div>

          <div className="sdg-tpl-grid" role="radiogroup" aria-label="Store template">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={template === t.id}
                className={`sdg-tpl${template === t.id ? ' is-active' : ''}`}
                onClick={() => setTemplate(t.id)}
              >
                <span className={`sdg-thumb sdg-${t.id}`} aria-hidden>
                  <span className="sdg-thumb-nav" />
                  <span className="sdg-thumb-hero" />
                  <span className="sdg-thumb-row">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <span className="sdg-tpl-name">
                  {t.name}
                  {t.tier === 'premium' && <em>Paid</em>}
                </span>
                <span className="sdg-tpl-best">{t.bestFor}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --------------------------- AI designer -------------------------- */}
        <div className="sdg-block sdg-ai">
          <div className="sdg-block-head">
            <div>
              <h3>
                <Sparkles size={15} aria-hidden /> AI theme designer
              </h3>
              <p>Describe your shop and the AI drafts the colours, fonts and layout.</p>
            </div>
          </div>

          <div className="sdg-ai-row">
            <label className="sdg-visually-hidden" htmlFor="sdg-brief">
              Describe the store you want
            </label>
            <input
              id="sdg-brief"
              type="text"
              value={brief}
              maxLength={300}
              placeholder="e.g. warm and elegant fabric shop with gold accents"
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void designWithAi();
                }
              }}
            />
            <select
              aria-label="Store category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={designWithAi} disabled={busy}>
              {busy ? <Loader2 size={15} className="sdg-spin" aria-hidden /> : <Wand2 size={15} aria-hidden />}
              {busy ? 'Designing…' : 'Design it'}
            </button>
          </div>

          {note && (
            <p className="sdg-note">
              <Check size={13} aria-hidden /> {note}
            </p>
          )}
          {error && <p className="sdg-error">{error}</p>}

          <div className="sdg-presets" aria-label="Preset looks">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="sdg-preset"
                onClick={() => applyTheme({ ...p.theme }, p.note)}
              >
                <span
                  className="sdg-preset-dot"
                  style={{ background: `linear-gradient(135deg, ${p.theme.accent}, ${p.theme.bg})` }}
                  aria-hidden
                />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------ preview ----------------------------- */}
      <div className="sdg-preview-wrap">
        <div className="sdg-preview-head">
          <strong>Live preview</strong>
          <span>
            {active?.name ?? 'Modern'} template
            {active && <> · best for {active.bestFor.toLowerCase()}</>}
          </span>
        </div>

        <div className="sdg-browser">
          <div className="sdg-browser-bar">
            <span className="sdg-browser-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="sdg-browser-url">kwaravend.ng/s/kwara-fashions</span>
          </div>

          <div
            className={`site-shell sdg-page${compact ? ' is-compact' : ''}`}
            data-layout={template}
            data-hero-bg={theme.heroStyle === 'solid' ? 'true' : undefined}
            style={previewVars}
          >
            <div className="sdg-masthead">
              <span className="sdg-brand">Kwara Fashions</span>
              <span className="sdg-masthead-links" aria-hidden>
                <i>Shop</i>
                <i>About</i>
                <i>Visit</i>
              </span>
            </div>

            <div
              className={`page-hero sdg-hero${theme.heroStyle === 'gradient' ? ' is-gradient' : ''}`}
            >
              <span className="sdg-hero-badge">Ilorin · Kwara</span>
              <h3>Ankara, aso-oke and bespoke tailoring</h3>
              <p>Order on WhatsApp, pick up in Tanke or get it delivered across Ilorin.</p>
              <div className="sdg-hero-ctas">
                <span className="btn btn-primary btn-sm">Shop the collection</span>
                <span className="sdg-ghost-btn">Chat on WhatsApp</span>
              </div>
            </div>

            <div className="sdg-products">
              {[
                { name: 'Ankara two-piece', price: '₦24,000' },
                { name: 'Aso-oke set', price: '₦38,500' },
                { name: 'Bespoke agbada', price: '₦55,000' },
              ].map((item) => (
                <div key={item.name} className="sdg-product">
                  <span className="sdg-product-thumb" aria-hidden />
                  <strong>{item.name}</strong>
                  <span className="price">{item.price}</span>
                </div>
              ))}
            </div>

            <div className="sdg-footer">
              <span>Open Mon–Sat · 9am–7pm</span>
              <span>Tanke, Ilorin</span>
            </div>
          </div>
        </div>

        <div className="sdg-preview-foot">
          <span>
            <Check size={13} aria-hidden /> Your colours, fonts and images stay — templates change the structure.
          </span>
          <span className="sdg-preview-cta">Free plan includes {STARTER_TEMPLATE_COUNT} templates</span>
        </div>
      </div>
    </div>
  );
}
