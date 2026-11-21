'use client';

// Language dock — English / Naija Pidgin / Yoruba.
//
// It does two jobs in one component because they share state:
//  1. pick the language (persisted in a 1-year cookie so it survives reloads);
//  2. translate the live interface.
//
// Translation has two layers so the switcher always does something:
//   a. PHRASEBOOK — the navigation/button strings in @idevtenancy/shared are
//      translated instantly, with no network and no model key.
//   b. AI route — every remaining visible string is batched to /api/translate,
//      cached per (language, string) in sessionStorage, and written back. A
//      MutationObserver keeps newly-rendered content (chat messages, filtered
//      results, accordions) in the same language.
//
// Everything is honest about failure: with no model key the API reports
// `provider: dummy` (an identity translation), so the dock keeps the offline
// phrases, says that free-form content needs a model key, and never pretends
// the page was translated when it was not.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGES, PHRASEBOOK, type LanguageCode } from '@idevtenancy/shared';
import { callApi } from '@/lib/api-client';
import { Check as IcCheck, Globe as IcGlobe } from 'lucide-react';

const COOKIE = 'nv_lang';
// BCP-47 codes for <html lang>; Nigerian Pidgin is `pcm`, not `pid`.
const HTML_LANG: Record<LanguageCode, string> = { en: 'en-NG', pid: 'pcm', yo: 'yo' };
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG']);
const MAX_NODES = 240;

function readLang(): LanguageCode {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-z]{2,4})`));
  const code = m?.[1];
  return (LANGUAGES as ReadonlyArray<{ code: string }>).some((l) => l.code === code) ? (code as LanguageCode) : 'en';
}

function writeLang(code: LanguageCode) {
  document.cookie = `${COOKIE}=${code};path=/;max-age=31536000;samesite=lax`;
}

function cacheKey(lang: LanguageCode) {
  return `nv.tr.${lang}`;
}

function loadCache(lang: LanguageCode): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(lang)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(lang: LanguageCode, cache: Record<string, string>) {
  try {
    sessionStorage.setItem(cacheKey(lang), JSON.stringify(cache));
  } catch {
    // Quota — the cache is an optimisation, dropping it only costs a re-fetch.
  }
}

/** The offline phrasebook as a cache-shaped table, so both layers share one lookup. */
function phrasebookCache(lang: LanguageCode): Record<string, string> {
  if (lang === 'en') return {};
  const out: Record<string, string> = {};
  for (const [english, translated] of Object.entries(PHRASEBOOK[lang])) out[english] = translated;
  return out;
}

/** Pure-ish visibility check: does this text node belong to the interface? */
function isTranslatable(node: Text): boolean {
  const value = node.nodeValue ?? '';
  if (value.trim().length < 2 || value.length > 600) return false;
  // Numbers, prices, IDs, emoji-only, single punctuation.
  if (!/[A-Za-zÀ-ɏ]{2}/.test(value)) return false;
  if (/^\s*[\d₦$.,:%+\-/()\s]+\s*$/.test(value)) return false;
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.hasAttribute('data-no-translate') || el.closest('[data-no-translate]')) return false;
  }
  return true;
}

/** Visible, not-yet-translated text nodes in document order. */
function collectNodes(applied: WeakSet<Text>): Text[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const node = current as Text;
    if (!isTranslatable(node) || applied.has(node)) continue;
    nodes.push(node);
  }
  return nodes;
}

export function LanguageDock() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // node → original English + the value we wrote, so "Show original" is
  // instant, lossless, and never clobbers text React has since re-rendered.
  const originalsRef = useRef(new Map<Text, { original: string; translated: string }>());
  const cacheRef = useRef<Record<string, string>>({});
  const appliedRef = useRef(new WeakSet<Text>());
  // Languages whose model translation already fell back to the identity
  // provider — retrying on every DOM mutation would only spam the API.
  const dummyRef = useRef<LanguageCode | null>(null);
  // Our own writes replay as mutations; ignore them for a moment.
  const suppressUntilRef = useRef(0);
  // Bumped on every language change; a run that starts under an older id must
  // never write its (now wrong-language) results into the page.
  const runRef = useRef(0);

  const restore = useCallback(() => {
    for (const [node, { original, translated }] of originalsRef.current) {
      // Only put English back where our translation is still the visible text.
      if (node.isConnected && (node.nodeValue ?? '').trim() === translated.trim()) {
        node.nodeValue = original;
      }
    }
    originalsRef.current.clear();
    appliedRef.current = new WeakSet<Text>();
  }, []);

  /** Write one translation into a node, remembering the English it replaced. */
  const applyNode = useCallback((node: Text, translated: string) => {
    if (appliedRef.current.has(node)) return;
    const current = node.nodeValue ?? '';
    if (!current.trim()) return;
    const known = originalsRef.current.get(node);
    if (known) known.translated = translated;
    else originalsRef.current.set(node, { original: current, translated });
    appliedRef.current.add(node);
    suppressUntilRef.current = Date.now() + 400;
    // Keep surrounding whitespace from the original node (indentation between
    // tags) — only the trimmed text is translated.
    const lead = current.match(/^\s*/)?.[0] ?? '';
    const trail = current.match(/\s*$/)?.[0] ?? '';
    node.nodeValue = `${lead}${translated}${trail}`;
  }, []);

  /** Pass 1: apply everything we already know (phrasebook + session cache). */
  const applyKnown = useCallback(
    (language: LanguageCode): Text[] => {
      const remaining: Text[] = [];
      for (const node of collectNodes(appliedRef.current)) {
        const key = (node.nodeValue ?? '').trim();
        const known = cacheRef.current[key];
        if (known) applyNode(node, known);
        else remaining.push(node);
      }
      return remaining;
    },
    [applyNode],
  );

  /** Pass 2: ask the AI route for the rest, in batches, without blocking the UI. */
  const translateRemaining = useCallback(
    async (nodes: Text[], language: LanguageCode, run: number) => {
      if (dummyRef.current === language) return;
      const chunks: Text[][] = [];
      for (let i = 0; i < nodes.length && i < MAX_NODES; i += 30) chunks.push(nodes.slice(i, i + 30));

      for (const chunk of chunks) {
        if (runRef.current !== run) return;
        const texts = chunk.map((n) => (n.nodeValue ?? '').trim());
        let res: { texts: string[]; provider: string };
        try {
          res = await callApi<{ texts: string[]; provider: string }>('/api/translate', { texts, lang: language });
        } catch (err) {
          // One failed batch must not abandon the language choice — the offline
          // phrases stay applied and the user is told what happened.
          if (runRef.current === run) {
            setNotice(err instanceof Error ? err.message : 'Translation is unavailable right now.');
          }
          return;
        }
        if (runRef.current !== run) return;

        if (res.provider === 'dummy' || res.provider === 'noop') {
          dummyRef.current = language;
          setNotice('Menu and buttons are translated offline. Full page translation needs a model key on this deployment.');
          return;
        }

        res.texts.forEach((t, i) => {
          const original = texts[i];
          if (original && t && t !== original) cacheRef.current[original] = t;
        });
        saveCache(language, cacheRef.current);

        chunk.forEach((node) => {
          const translated = cacheRef.current[(node.nodeValue ?? '').trim()];
          if (translated) applyNode(node, translated);
        });
      }
    },
    [applyNode],
  );

  const translateAll = useCallback(
    async (language: LanguageCode) => {
      if (language === 'en' || typeof document === 'undefined') return;
      const run = ++runRef.current;
      setBusy(true);
      try {
        // Session cache first, then the phrasebook overrides/augments it — the
        // phrasebook is shipped with the app, so it is always current.
        cacheRef.current = { ...loadCache(language), ...phrasebookCache(language) };
        const remaining = applyKnown(language);
        if (remaining.length) await translateRemaining(remaining, language, run);
      } finally {
        if (runRef.current === run) setBusy(false);
      }
    },
    [applyKnown, translateRemaining],
  );

  // Pick up the stored preference once (client-only: the cookie is not in SSR
  // output, so this must not run during render).
  useEffect(() => {
    const initial = readLang();
    setLang(initial);
    document.documentElement.lang = HTML_LANG[initial];
    if (initial !== 'en') void translateAll(initial);
  }, [translateAll]);

  // Keep newly rendered content in step (4s chat polls, search refilters…).
  useEffect(() => {
    if (lang === 'en') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (Date.now() < suppressUntilRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void translateAll(lang), 900);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [lang, translateAll]);

  const choose = useCallback(
    (code: LanguageCode) => {
      setOpen(false);
      writeLang(code);
      setLang(code);
      setNotice(null);
      // An explicit choice is also a retry: a model key may have been added.
      dummyRef.current = null;
      document.documentElement.lang = HTML_LANG[code];
      // Invalidate any in-flight run before touching the DOM.
      runRef.current += 1;
      restore();
      if (code === 'en') {
        setBusy(false);
        return;
      }
      void translateAll(code);
    },
    [restore, translateAll],
  );

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="lang-dock" data-no-translate>
      <button
        type="button"
        className="lang-dock-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Change language — English, Pidgin, Yoruba"
      >
        <IcGlobe className="ico-inline" aria-hidden /> <span className="lang-dock-label">{current?.native}</span>
        {busy && <span className="lang-dock-busy" aria-label="Translating" />}
      </button>

      {open && (
        <div className="lang-dock-menu" role="menu">
          <p className="lang-dock-title">Interface &amp; chat language</p>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              className={`lang-dock-item${l.code === lang ? ' is-active' : ''}`}
              onClick={() => choose(l.code)}
            >
              <span>{l.native}</span>
              <span className="lang-dock-sub">{l.label}</span>
              {l.code === lang && <span aria-hidden><IcCheck className="ico-inline" aria-hidden /></span>}
            </button>
          ))}
          {lang !== 'en' && (
            <button type="button" className="lang-dock-item lang-dock-reset" onClick={() => choose('en')}>
              <span>Show original (English)</span>
            </button>
          )}
          {notice && <p className="lang-dock-note">{notice}</p>}
        </div>
      )}
    </div>
  );
}
