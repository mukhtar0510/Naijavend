import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiComplete, createProviderFromEnv } from './index';
import { GeminiProvider } from './gemini';

// GeminiProvider turns Gemini JSON replies into sanitized AI drafts. Every
// field is validated against the same whitelists the settings API enforces,
// and any hard failure degrades aiComplete to the dummy provider.

// Env set before the first aiComplete() call in this file, so the cached
// provider is Gemini (each vitest file gets a fresh module registry).
process.env.GEMINI_API_KEY = 'test-key-123';

function geminiReply(text: string, tokens = 321): unknown {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { totalTokenCount: tokens },
    }),
  };
}

function stubFetch(handler: (url: string, init: RequestInit) => unknown) {
  const mock = vi.fn(async (url: string, init: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('provider selection', () => {
  it('GEMINI_API_KEY present → gemini provider', () => {
    expect(createProviderFromEnv({ GEMINI_API_KEY: '  k ' }).name).toBe('gemini');
  });

  it('no key → deterministic dummy provider', () => {
    expect(createProviderFromEnv({}).name).toBe('dummy');
  });
});

describe('GeminiProvider request/response', () => {
  it('store_setup: posts to generateContent with the key header and sanitizes the draft', async () => {
    const fetchMock = stubFetch((url, init) => {
      expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key-123');
      return geminiReply(
        JSON.stringify({
          name: 'Aso Republic',
          description: 'Vibrant Ankara prints tailored for every occasion. Fast WhatsApp replies.',
          category: 'fashion',
        }),
      );
    });

    const r = await aiComplete({ feature: 'store_setup', input: 'I sell aso ebi fabrics in Lagos' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.provider).toBe('gemini');
    expect(r.tokensUsed).toBe(321);
    const draft = r.draft as { name: string; category: string };
    expect(draft.name).toBe('Aso Republic');
    expect(draft.category).toBe('fashion');
  });

  it('store_setup: off-whitelist category falls back to the dummy draft', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ name: 'X Store', description: 'We sell great things.', category: 'crypto-dropship' })));
    const r = await aiComplete({ feature: 'store_setup', input: 'a small shop in Abuja' });
    expect(r.provider).toBe('dummy');
    expect((r.draft as { category: string }).category.length).toBeGreaterThan(0);
  });

  it('style_store: hallucinated values are replaced with safe defaults', async () => {
    stubFetch(() =>
      geminiReply(
        JSON.stringify({
          accent_color: 'purple',
          accent_soft: 'nope',
          accent_text: '#000000',
          font_heading: 'Comic Sans',
          font_body: 'Wingdings',
          layout: 'chaos',
          hero_style: 'spin',
          background_color: '#FFFBF8',
          note: 'A lovely boutique feel.',
        }),
      ),
    );

    const r = await aiComplete({ feature: 'style_store', input: '(beauty): elegant boutique' });
    const s = r.draft as Record<string, unknown>;
    expect(s.accent_color).toBe('#1D4ED8');
    expect(s.accent_soft).toBe('#3B82F6');
    // Contrast pick is recomputed, never trusted from the model.
    expect(s.accent_text).toBe('#FFFFFF');
    expect(s.font_heading).toBe('Sora');
    expect(s.font_body).toBe('Inter');
    expect(s.layout).toBe('modern');
    expect(s.hero_style).toBe('gradient');
  });

  it('style_store: dark backgrounds automatically gain the light-text trio', async () => {
    stubFetch(() =>
      geminiReply(
        JSON.stringify({
          accent_color: '#A855F7',
          background_color: '#0F0A1E',
          font_heading: 'Space Grotesk',
          font_body: 'Inter',
          layout: 'bold',
          hero_style: 'gradient',
          note: 'Neon night look.',
        }),
      ),
    );

    const r = await aiComplete({ feature: 'style_store', input: '(gaming): dark neon' });
    const s = r.draft as Record<string, unknown>;
    expect(s.background_color).toBe('#0F0A1E');
    expect(s.text_color).toBe('#E8ECF2');
    expect(s.heading_color).toBe('#FFFFFF');
    expect(s.muted_color).toBe('#AEB6C2');
  });

  it('HTTP 500 → aiComplete degrades to the dummy provider', async () => {
    stubFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    const r = await aiComplete({ feature: 'listing_description', input: 'handmade bead necklaces' });
    expect(r.provider).toBe('dummy');
    expect((r.draft as { description: string }).description.length).toBeGreaterThan(10);
  });

  it('non-JSON reply → aiComplete degrades to the dummy provider', async () => {
    stubFetch(() => geminiReply('Here is your draft: I will not produce JSON today.'));
    const r = await aiComplete({ feature: 'listing_description', input: 'home cleaning service' });
    expect(r.provider).toBe('dummy');
  });

  it('custom model override reaches the endpoint path', async () => {
    const fetchMock = stubFetch((url) => {
      expect(url).toContain('/models/gemini-1.5-flash:generateContent');
      return geminiReply(JSON.stringify({ description: 'Fresh pastries baked every morning. Message us on WhatsApp to order a box for your event or office.' }));
    });
    const p = new GeminiProvider('k', 'gemini-1.5-flash');
    const r = await p.complete({ feature: 'listing_description', input: 'bakery' });
    expect(r.provider).toBe('gemini');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('assistant chat', () => {
  it('gemini: returns the grounded reply', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ reply: 'Post daily and reply fast on WhatsApp.\nNext step: share your store link today.' })));
    const r = await aiComplete({ feature: 'assistant_chat', input: '[Store] Aso Republic | category: fashion\n[Chat]\nSeller: How do I get more orders?' });
    expect(r.provider).toBe('gemini');
    expect((r.draft as { reply: string }).reply).toContain('WhatsApp');
  });

  it('gemini: keeps line breaks in the reply', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ reply: 'line one\nline two' })));
    const r = await aiComplete({ feature: 'assistant_chat', input: '[Chat]\nSeller: tips?' });
    expect((r.draft as { reply: string }).reply).toBe('line one\nline two');
  });

  it('gemini: empty reply falls back to the dummy assistant', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ reply: '  ' })));
    const r = await aiComplete({ feature: 'assistant_chat', input: '[Store] X\n[Chat]\nSeller: How do I get more orders?' });
    expect(r.provider).toBe('dummy');
    expect((r.draft as { reply: string }).reply).toContain('X');
  });

  it('dummy: replies reference the store and question keywords', async () => {
    const dummy = createProviderFromEnv({});
    const r = await dummy.complete({
      feature: 'assistant_chat',
      input: '[Store] Bead Haven | category: crafts\n[Stats] listings: 4\n[Chat]\nSeller: How do I get more orders?',
    });
    const reply = (r.draft as { reply: string }).reply;
    expect(reply).toContain('Bead Haven');
    expect(reply).toContain('WhatsApp');
  });
});

describe('social posts', () => {
  it('gemini: returns the drafted post', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ post: 'Fresh beads just landed!\nOrder on WhatsApp today.' })));
    const r = await aiComplete({ feature: 'social_post', input: '[Store] Bead Haven | category: crafts\n[Platform] whatsapp\n[Topic] Fresh bead bracelets' });
    expect(r.provider).toBe('gemini');
    expect((r.draft as { post: string }).post).toContain('beads');
  });

  it('gemini: too-short post falls back to the dummy template', async () => {
    stubFetch(() => geminiReply(JSON.stringify({ post: 'hi' })));
    const r = await aiComplete({ feature: 'social_post', input: '[Store] Bead Haven | category: crafts\n[Platform] instagram\n[Topic] bead bracelets' });
    expect(r.provider).toBe('dummy');
    expect((r.draft as { post: string }).post).toContain('Bead Haven');
    expect((r.draft as { post: string }).post).toContain('#');
  });

  it('dummy: instagram template includes hashtags; whatsapp does not', async () => {
    const dummy = createProviderFromEnv({});
    const ig = await dummy.complete({ feature: 'social_post', input: '[Store] Bead Haven | category: crafts\n[Platform] instagram\n[Topic] bead bracelets' });
    expect((ig.draft as { post: string }).post).toContain('#NaijaBusiness');
    const wa = await dummy.complete({ feature: 'social_post', input: '[Store] Bead Haven | category: crafts\n[Platform] whatsapp\n[Topic] bead bracelets' });
    expect((wa.draft as { post: string }).post).not.toContain('#');
  });
});
