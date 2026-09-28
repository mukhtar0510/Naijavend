'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STORE_CATEGORIES, categoryEmoji, categoryLabel } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import { CategoryPicker } from '@/components/CategoryPicker';
import { trackStepView, trackStepComplete, trackChip, trackPreviewShown, trackAbandon } from '@/lib/funnel';

interface AiPreview {
  name: string;
  description: string;
  category: string;
}

const STEPS = [
  { n: 1, label: 'Your business', ico: '🏪' },
  { n: 2, label: 'AI draft', ico: '✨' },
  { n: 3, label: 'Go live', ico: '🚀' },
] as const;

const ASIDE_COPY: Record<number, { h: string; p: string }> = {
  1: { h: "Let's open your store.", p: 'Tell us what you sell — the AI handles the paperwork.' },
  2: { h: 'Your draft is ready.', p: 'Keep the AI suggestions or make them yours — nothing is live yet.' },
  3: { h: 'Pick your corner of the web.', p: 'Choose your store link and launch in one click.' },
};

const TYPE_OPTIONS = [
  { value: 'product', ico: '📦', title: 'Products', hint: 'Physical goods you stock or ship' },
  { value: 'service', ico: '📅', title: 'Services', hint: 'Bookable appointments' },
  { value: 'hybrid', ico: '🧺', title: 'Both', hint: 'A mix of products and services' },
] as const;

// Tap-to-add keywords for step 1: on a phone, typing a business description is
// the slowest part — these build a perfectly good AI prompt in a few taps.
// Values already in the textarea are dimmed and act as a remove toggle.
const QUICK_PICKS = [
  'I braid hair', 'I do makeup', 'I sell wigs', 'I tailor clothes', 'I sell ready-to-wear',
  'I bake cakes', 'small chops', 'I cater for events', 'I sell foodstuff', 'I run a mini supermarket',
  'I sell kitchen utensils', 'I make crochet pieces', 'I sell handmade beads', 'personal trainer',
  'I tutor students', 'phone repairs', 'I sell phone accessories', 'I sell gadgets',
  'I ship from a supplier', 'in Lagos', 'in Abuja', 'in Port Harcourt', 'delivery available',
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessType, setBusinessType] = useState<'product' | 'service' | 'hybrid'>('product');
  const [isDropshipper, setIsDropshipper] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null);
  const [useAiName, setUseAiName] = useState(true);
  const [useAiDescription, setUseAiDescription] = useState(true);
  const [useAiCategory, setUseAiCategory] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1Valid = businessDescription.trim().length >= 10;

  // Live AI preview: the current provider is a deterministic template generator,
  // so running it in the browser produces EXACTLY the draft step 2 will get —
  // with no API call, no rate-limit hit and no ai_usage_log spam. If a real LLM
  // provider lands later this must move server-side again (gated, debounced).
  const [liveDraft, setLiveDraft] = useState<{ name: string; description: string; category: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const text = businessDescription.trim();
    if (text.length < 10) {
      setLiveDraft(null);
      return;
    }
    aiComplete({ feature: 'store_setup', input: text })
      .then((result) => {
        if (!cancelled) setLiveDraft(result.draft as { name: string; description: string; category: string });
      })
      .catch(() => {
        if (!cancelled) setLiveDraft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessDescription]);

  // ---- funnel analytics (fire-and-forget, never blocks the flow) ----
  const funnel = useRef({ published: false });
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    trackStepView(step);
    if (step > 1) trackStepComplete(step - 1);
  }, [step]);
  const previewTracked = useRef(false);
  useEffect(() => {
    if (liveDraft && !previewTracked.current) {
      previewTracked.current = true;
      trackPreviewShown();
    }
  }, [liveDraft]);
  useEffect(() => {
    // Unpublish exit = abandon. publish() flips the flag before navigating.
    return () => {
      if (!funnel.current.published) trackAbandon(stepRef.current);
    };
  }, []);
  const step2Valid = (useAiName || name.trim().length >= 2) && (useAiDescription || description.trim().length >= 10);

  const slugPreview = useMemo(() => slug || 'your-store', [slug]);

  async function generateDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/draft-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDescription }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not generate a draft.');
      setAiPreview(body.draft);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    funnel.current.published = true; // suppress the abandon event
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDescription,
          businessType,
          isDropshipper,
          name,
          slug,
          description,
          category,
          useAiName,
          useAiDescription,
          useAiCategory,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not create your store.');
      router.push(`/dashboard?created=${body.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Quick-pick chips append (or remove) a short phrase in the description box.
  function toggleQuickPick(phrase: string) {
    if (!businessDescription.toLowerCase().includes(phrase.toLowerCase())) trackChip(phrase);
    setBusinessDescription((prev) => {
      const has = prev.toLowerCase().includes(phrase.toLowerCase());
      if (has) {
        // Remove the phrase plus a preceding comma/space left behind.
        const pattern = new RegExp(`,?\\s*${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'ig');
        return prev.replace(pattern, '').replace(/^[\s,]+/, '').replace(/\s{2,}/g, ' ').trim();
      }
      return prev ? `${prev.replace(/\s+$/, '')}, ${phrase}` : phrase;
    });
  }

  // One-tap accept: pin the live preview as the seller's own edits and jump to
  // step 2 — skips the server AI round-trip entirely (the preview runs the same
  // deterministic generator, so this is byte-identical to what draftWithAi
  // would return; if a real LLM provider lands, regenerate server-side here).
  function useDraftNow() {
    if (!liveDraft) return;
    setName(liveDraft.name);
    setDescription(liveDraft.description);
    setCategory(liveDraft.category);
    setUseAiName(false);
    setUseAiDescription(false);
    setUseAiCategory(false);
    trackStepComplete(1);
    setStep(2);
  }

  function toggleAiName(next: boolean) {
    setUseAiName(next);
    if (!next && !name.trim() && aiPreview) setName(aiPreview.name);
  }

  function toggleAiDescription(next: boolean) {
    setUseAiDescription(next);
    if (!next && !description.trim() && aiPreview) setDescription(aiPreview.description);
  }

  return (
    <div className="ob-shell">
      <aside className="ob-aside">
        <div className="auth-blob ab1" />
        <div className="auth-blob ab2" />
        <div className="ob-brand">
          Naija<span>vend</span>
        </div>

        <div style={{ position: 'relative' }}>
          <h2 key={step} className="ob-aside-h">{ASIDE_COPY[step]?.h}</h2>
          <p className="auth-tagline" key={`p${step}`}>{ASIDE_COPY[step]?.p}</p>
        </div>

        <ol className="ob-steps" aria-label="Setup progress">
          {STEPS.map((s) => {
            const state = s.n === step ? 'active' : s.n < step ? 'done' : 'todo';
            return (
              <li key={s.n} className={`ob-step is-${state}`} aria-current={s.n === step ? 'step' : undefined}>
                <button
                  type="button"
                  className="ob-step-btn"
                  onClick={() => s.n < step && setStep(s.n)}
                  disabled={s.n > step || (s.n === 2 && !aiPreview)}
                >
                  <span className="ob-step-dot" aria-hidden>
                    {state === 'done' ? '✓' : s.ico}
                  </span>
                  <span className="ob-step-label">
                    <strong>Step {s.n}</strong>
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="ob-aside-foot">Takes about two minutes · no card required</p>
      </aside>

      <main className="auth-panel ob-panel">
        <div className="card auth-card ob-card" key={step}>
          {/* Mobile progress bar (aside is hidden on small screens) */}
          <div className="ob-mobile-progress" role="status">
            <div className="ob-mobile-bar">
              <span style={{ width: `${(step / STEPS.length) * 100}%` }} />
            </div>
            <p>Step {step} of {STEPS.length} — {STEPS[step - 1].label}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {step === 1 && (
            <>
              <h1>Tell us about your business</h1>
              <p className="auth-sub">One or two honest sentences is plenty — our AI drafts the rest.</p>

              <div className="field">
                <label htmlFor="desc">What do you do, and where?</label>
                <textarea
                  id="desc"
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  placeholder="e.g. I braid hair and do makeup for events in Surulere, Lagos. I also sell wigs."
                  maxLength={600}
                  required
                />
                <p className="hint">{businessDescription.trim().length}/600 — the AI drafts your name, description and category from this.</p>
              </div>

              {liveDraft && (
                <div className="card ob-live-preview" aria-live="polite">
                  <div className="ob-live-head">
                    <span aria-hidden>✨</span> <strong>Live preview</strong>
                    <span className="ob-live-mut">— updates as you tap or type</span>
                  </div>
                  <div className="ob-live-name">
                    <span className="ob-sum-k">Store name</span>
                    <strong>{liveDraft.name}</strong>
                  </div>
                  <p className="ob-live-desc">{liveDraft.description}</p>
                  <div>
                    <span className="badge">{categoryEmoji(liveDraft.category)} {categoryLabel(liveDraft.category)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={useDraftNow}>
                      ⚡ Use this draft →
                    </button>
                    <p className="hint" style={{ margin: 0 }}>
                      or keep typing — you can edit every word before anything goes live.
                    </p>
                  </div>
                </div>
              )}

              <div className="field">
                <span className="ob-field-label">Quick add <span className="ob-quick-mut">(tap what you sell)</span></span>
                <div className="ob-quick-grid" role="group" aria-label="Quick add what you sell">
                  {QUICK_PICKS.map((phrase) => {
                    const on = businessDescription.toLowerCase().includes(phrase.toLowerCase());
                    return (
                      <button
                        key={phrase}
                        type="button"
                        aria-pressed={on}
                        className={`ob-quick-chip${on ? ' is-on' : ''}`}
                        onClick={() => toggleQuickPick(phrase)}
                      >
                        {on ? '✓ ' : '+ '}{phrase}
                      </button>
                    );
                  })}
                </div>
                <p className="hint">Tap a few, then add your city and anything we missed — or just type instead.</p>
              </div>

              <div className="field">
                <span className="ob-field-label">What do you sell?</span>
                <div className="ob-type-grid" role="radiogroup" aria-label="Business type">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={businessType === t.value}
                      className={`ob-type-card${businessType === t.value ? ' is-active' : ''}`}
                      onClick={() => setBusinessType(t.value)}
                    >
                      <span className="ob-type-ico" aria-hidden>{t.ico}</span>
                      <strong>{t.title}</strong>
                      <span className="ob-type-hint">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {businessType !== 'service' && (
                <button
                  type="button"
                  className={`ob-dropship${isDropshipper ? ' is-active' : ''}`}
                  role="checkbox"
                  aria-checked={isDropshipper}
                  onClick={() => setIsDropshipper((v) => !v)}
                >
                  <span className="ob-type-ico" aria-hidden>🚚</span>
                  <span>
                    <strong>I ship from a supplier (dropshipping)</strong>
                    <span className="ob-type-hint">
                      Get a verified Dropshipper tag and a shipping card on your store. Supplier details can be added later.
                    </span>
                  </span>
                  <span className="ob-dropship-mark" aria-hidden>{isDropshipper ? '✓' : ''}</span>
                </button>
              )}

              <button className="btn btn-primary ob-cta" onClick={generateDraft} disabled={busy || !step1Valid}>
                {busy ? 'Drafting your store…' : 'Draft my store with AI →'}
              </button>
              {!step1Valid && <p className="hint ob-cta-hint">Write at least 10 characters to continue.</p>}
            </>
          )}

          {step === 2 && aiPreview && (
            <>
              <h1>Review your AI draft</h1>
              <p className="auth-sub">
                Nothing is published yet. Uncheck a box to edit that part yourself — you keep final say on every word.
              </p>

              <div className="field">
                <label className="ob-check">
                  <input type="checkbox" checked={useAiName} onChange={(e) => toggleAiName(e.target.checked)} />
                  <span>Use the AI store name</span>
                </label>
                <input
                  type="text"
                  value={useAiName ? aiPreview.name : name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  disabled={useAiName}
                  placeholder="Your store name"
                />
              </div>

              <div className="field">
                <label className="ob-check">
                  <input type="checkbox" checked={useAiDescription} onChange={(e) => toggleAiDescription(e.target.checked)} />
                  <span>Use the AI description</span>
                </label>
                <textarea
                  value={useAiDescription ? aiPreview.description : description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  disabled={useAiDescription}
                  placeholder="Describe your store"
                  rows={4}
                />
              </div>

              <div className="field">
                <label className="ob-check">
                  <input type="checkbox" checked={useAiCategory} onChange={(e) => setUseAiCategory(e.target.checked)} />
                  <span>Use the AI category</span>
                </label>
                <CategoryPicker
                  value={useAiCategory ? aiPreview.category : category}
                  onChange={setCategory}
                  disabled={useAiCategory}
                />
                {useAiCategory && <p className="hint">AI suggests: {aiPreview.category}</p>}
              </div>

              <div className="ob-nav">
                <button className="btn btn-outline" onClick={() => setStep(1)} disabled={busy}>← Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} disabled={busy || !step2Valid}>Continue →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Your store link</h1>
              <p className="auth-sub">This is the address customers will visit — short and memorable works best.</p>

              <div className="field">
                <label htmlFor="slug">Your store link</label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="adaeze-braids"
                  maxLength={60}
                />
                <p className="ob-slug-preview">idevtenancy.com/s/<strong>{slugPreview}</strong></p>
              </div>

              <div className="ob-summary" aria-label="Launch summary">
                <div>
                  <span className="ob-sum-k">Store</span>
                  <span className="ob-sum-v">{useAiName ? aiPreview?.name || 'AI-drafted name' : name}</span>
                </div>
                <div>
                  <span className="ob-sum-k">Sells</span>
                  <span className="ob-sum-v">{TYPE_OPTIONS.find((t) => t.value === businessType)?.title}</span>
                </div>
                <div>
                  <span className="ob-sum-k">Extras</span>
                  <span className="ob-sum-v">
                    {isDropshipper ? '🚚 Dropshipper tag' : 'Standard store'}
                    {(useAiName || useAiDescription) && ' · ✨ AI-assisted copy'}
                  </span>
                </div>
              </div>

              <div className="ob-nav">
                <button className="btn btn-outline" onClick={() => setStep(2)} disabled={busy}>← Back</button>
                <button className="btn btn-primary" onClick={publish} disabled={busy}>
                  {busy ? 'Publishing…' : '🚀 Create my store'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
