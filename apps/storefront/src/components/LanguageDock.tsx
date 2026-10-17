'use client';

// Language dock — English / Naija Pidgin / Yoruba / Hausa / Igbo.
//
// It does two jobs in one component because they share state:
//  1. pick the language (persisted in a 1-year cookie so it survives reloads);
//  2. translate the live interface: walk the visible text nodes, batch them to
//     /api/translate, cache per (language, string) in sessionStorage, and write
//     the results back. A MutationObserver keeps newly-rendered content (chat
//     messages, filtered results, accordions) in the same language.
//
// Everything is honest about failure: with no model key the API reports
// `provider: dummy` (an identity translation), and this component then keeps
// the preference but shows "translation needs a model key" instead of silently
// rendering English under a Hausa label.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGES, type LanguageCode } from '@idevtenancy/shared';
import { callApi } from '@/lib/api-client';

const COOKIE = 'nv_lang';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG']);

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

export function LanguageDock() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // node → original English text, so "Show original" is instant and lossless.
  const originalsRef = useRef(new Map<Text, string>());
  const cacheRef = useRef<Record<string, string>>({});
  const appliedRef = useRef(new WeakSet<Text>());
  const runningRef = useRef(false);

  const restore = useCallback(() => {
    for (const [node, original] of originalsRef.current) {
      node.nodeValue = original;
    }
    originalsRef.current.clear();
    appliedRef.current = new WeakSet<Text>();
  }, []);

  const pushTranslations = useCallback(async (targets: Text[], language: LanguageCode) => {
    const pending = targets.filter((n) => !cacheRef.current[n.nodeValue!.trim()]);
    const chunks: Text[][] = [];
    for (let i = 0; i < pending.length; i += 30) chunks.push(pending.slice(i, i + 30));

    for (const chunk of chunks) {
      const texts = chunk.map((n) => n.nodeValue!.trim());
      const res = await callApi<{ texts: string[]; provider: string }>('/api/translate', { texts, lang: language });
      if (res.provider === 'dummy' || res.provider === 'noop') {
        setNotice('Translation needs a model key on this deployment — the interface stays in English.');
        return;
      }
      res.texts.forEach((t, i) => {
        const original = texts[i];
        if (original && t && t !== original) cacheRef.current[original] = t;
      });
      saveCache(language, cacheRef.current);
      chunk.forEach((node) => {
        const translated = cacheRef.current[node.nodeValue!.trim()];
        // Only rewrite when the node still carries the English we translated —
        // a React re-render may already have replaced it with new content.
        if (translated && !appliedRef.current.has(node)) {
          originalsRef.current.set(node, node.nodeValue!);
          appliedRef.current.add(node);
          node.nodeValue = translated;
        }
      });
    }
  }, []);

  const translateAll = useCallback(
    async (language: LanguageCode) => {
      if (language === 'en' || runningRef.current || typeof document === 'undefined') return;
      runningRef.current = true;
      setBusy(true);
      try {
        cacheRef.current = loadCache(language);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const targets: Text[] = [];
        let current: Node | null;
        while ((current = walker.nextNode())) {
          const node = current as Text;
          if (!isTranslatable(node) || appliedRef.current.has(node)) continue;
          const key = (node.nodeValue ?? '').trim();
          const cached = cacheRef.current[key];
          if (cached) {
            originalsRef.current.set(node, node.nodeValue!);
            appliedRef.current.add(node);
            node.nodeValue = cached;
          } else {
            targets.push(node);
          }
        }
        if (targets.length) await pushTranslations(targets.slice(0, 240), language);
      } catch (err) {
        console.warn('[i18n] page translation failed:', err);
      } finally {
        runningRef.current = false;
        setBusy(false);
      }
    },
    [pushTranslations],
  );

  // Pick up the stored preference once (client-only: the cookie is not in SSR
  // output, so this must not run during render).
  useEffect(() => {
    const initial = readLang();
    setLang(initial);
    if (initial !== 'en') void translateAll(initial);
  }, [translateAll]);

  // Keep newly rendered content in step (4s chat polls, search refilters…).
  useEffect(() => {
    if (lang === 'en') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
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
      if (code === 'en') {
        restore();
        return;
      }
      restore();
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
        title="Change language — English, Pidgin, Yoruba, Hausa, Igbo"
      >
        🌐 {current?.native}
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
              {l.code === lang && <span aria-hidden>✓</span>}
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