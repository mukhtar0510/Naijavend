// GeminiProvider — the real LLM backend for aiComplete, activated whenever
// GEMINI_API_KEY is present (Google AI Studio free tier, no card required).
//
// Design rules:
// - Structured output: responseMimeType application/json + explicit key
//   instructions; replies are parsed leniently (fences/whitespace tolerated).
// - NEVER trust the model: every field is sanitized against the same
//   whitelists the settings API enforces (STORE_FONTS, STORE_LAYOUTS, hex
//   format, category list), so a hallucination can never reach the DB.
// - Any hard failure (network, quota, non-JSON, missing required field)
//   throws; aiComplete then degrades to the deterministic dummy provider so
//   seller flows never break on a bad AI day.

import type {
  AiStoreDraft, AiListingDraft, AiStyleDraft, AiAssistantDraft, AiSocialPostDraft, AiImageDraft,
} from '@idevtenancy/shared';
import { isStoreFont, isStoreLayout, sanitizeText, STORE_FONTS, STORE_LAYOUTS } from '@idevtenancy/shared';
import type { AiProvider, AiRequest, AiResponse } from './index';
import { isDarkHex, readableTextOn } from './color';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const HERO_STYLES = new Set(['gradient', 'image', 'solid']);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Canonical store categories — must match the dummy stylist's rules. */
const STORE_CATEGORIES = [
  'beauty', 'fashion', 'kitchen', 'food', 'groceries', 'crafts', 'fitness',
  'education', 'home-services', 'dropshippers', 'electronics', 'software',
  'digital-products', 'gaming', 'marketing', 'health-wellness', 'baby-kids',
  'pets', 'jewelry', 'photography', 'music', 'art', 'events', 'auto',
  'agriculture', 'real-estate', 'professional-services', 'logistics',
  'printing', 'furniture', 'laundry', 'general',
] as const;

const SYSTEM_INSTRUCTION = [
  'You are the in-house copywriter and brand designer for Naijavend, a Nigerian',
  'social marketplace where small businesses sell products and services (beauty,',
  'fashion, food, repairs, tutoring and more). Write warm, concrete, trustworthy',
  'copy for Nigerian customers. Always reply with a single valid JSON object and',
  'nothing else — no markdown fences, no commentary before or after.',
].join(' ');

// ---------------------------------------------------------------------------
// Per-feature prompt builders + sanitizers
// ---------------------------------------------------------------------------

type AiDraft = AiStoreDraft | AiListingDraft | AiStyleDraft | AiAssistantDraft | AiSocialPostDraft | AiImageDraft;

interface FeatureSpec {
  system: string;
  user(input: string): string;
  sanitize(parsed: Record<string, unknown>, input: string): AiDraft;
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

function optHex(value: unknown): string | null {
  return typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim().toUpperCase() : null;
}

/** Like the shared sanitizeText, but preserves line breaks — chat replies and
 * social posts are multi-line by design (\n kept, all other control chars gone). */
export function sanitizeMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Pick a body font that differs from the heading font. */
function pairBodyFont(heading: string, candidate: unknown): string {
  if (typeof candidate === 'string' && isStoreFont(candidate.trim()) && candidate.trim() !== heading) {
    return candidate.trim();
  }
  return heading === 'Inter' ? 'Lora' : 'Inter';
}

const FEATURES: Record<AiRequest['feature'], FeatureSpec> = {
  store_setup: {
    system: SYSTEM_INSTRUCTION,
    user: (input) =>
      [
        `A Nigerian seller describes their business: "${input}"`,
        'Draft their store profile as JSON with exactly these keys:',
        '{"name": string, "description": string, "category": string}',
        '- name: catchy store name, max 48 characters, Title Case, no emojis or quotes.',
        '- description: 2-3 warm, concrete sentences (240-420 characters) that sell the business; plain text; mention fast WhatsApp replies.',
        `- category: exactly one of: ${STORE_CATEGORIES.join(', ')}.`,
      ].join('\n'),
    sanitize: (parsed): AiStoreDraft => {
      const name = sanitizeText(parsed.name, 48);
      const description = sanitizeText(parsed.description, 600);
      const rawCategory = typeof parsed.category === 'string' ? parsed.category.trim().toLowerCase() : '';
      if (name.length < 2) throw new Error('gemini store draft: unusable name');
      if (description.length < 30) throw new Error('gemini store draft: unusable description');
      if (!(STORE_CATEGORIES as readonly string[]).includes(rawCategory)) {
        throw new Error('gemini store draft: category outside whitelist');
      }
      return { name, description, category: rawCategory };
    },
  },

  listing_description: {
    system: SYSTEM_INSTRUCTION,
    user: (input) =>
      [
        `A Nigerian seller is listing this product or service: "${input}"`,
        'Write the listing description as JSON: {"description": string}',
        '- 2-4 sentences (200-480 characters) of confident selling copy, plain text, no emojis or hashtags.',
        '- End with a natural nudge to message on WhatsApp to order or book.',
      ].join('\n'),
    sanitize: (parsed): AiListingDraft => {
      const description = sanitizeText(parsed.description, 600);
      if (description.length < 40) throw new Error('gemini listing draft: too short');
      return { description };
    },
  },

  style_store: {
    system: SYSTEM_INSTRUCTION,
    user: (input) =>
      [
        `Design a store theme for this brief: "${input}"`,
        'Respond as JSON with exactly these keys:',
        '{"accent_color": "#RRGGBB", "accent_soft": "#RRGGBB", "accent_text": "#RRGGBB", "font_heading": string, "font_body": string, "layout": string, "hero_style": string, "background_color": "#RRGGBB", "note": string}',
        `- font_heading and font_body: two DIFFERENT fonts from this list: ${STORE_FONTS.join(', ')}.`,
        `- layout: exactly one of: ${STORE_LAYOUTS.join(', ')}.`,
        '- hero_style: "gradient", "image" or "solid".',
        '- accent_color: the main brand colour; accent_soft: a lighter companion tone; accent_text: black or white — whichever is readable on accent_color.',
        '- background_color: usually near-white (#FAFAFA to #FFFFFF). Only choose a dark background if the brief explicitly asks for dark, and then keep every hex readable.',
        '- note: one friendly sentence (max 140 characters) explaining the look.',
      ].join('\n'),
    sanitize: (parsed): AiStyleDraft => {
      const accent_color = hexOr(parsed.accent_color, '#1D4ED8');
      const accent_soft = hexOr(parsed.accent_soft, '#3B82F6');
      const background_color = hexOr(parsed.background_color, '#FFFFFF');
      const font_heading =
        typeof parsed.font_heading === 'string' && isStoreFont(parsed.font_heading.trim())
          ? parsed.font_heading.trim()
          : 'Sora';
      const font_body = pairBodyFont(font_heading, parsed.font_body);
      const rawLayout = typeof parsed.layout === 'string' ? parsed.layout.trim() : '';
      const layout = isStoreLayout(rawLayout) ? rawLayout : 'modern';
      const heroStyle = typeof parsed.hero_style === 'string' ? parsed.hero_style.trim() : '';
      const note = sanitizeText(parsed.note, 160) || 'A fresh look picked for your brief.';
      const draft: AiStyleDraft = {
        accent_color,
        accent_soft,
        // Never trust the model's contrast pick — recompute it.
        accent_text: readableTextOn(accent_color),
        font_heading,
        font_body,
        layout,
        hero_style: HERO_STYLES.has(heroStyle) ? (heroStyle as AiStyleDraft['hero_style']) : 'gradient',
        background_color,
        note,
      };
      // Dark backgrounds are only readable with the optional light-text trio.
      if (isDarkHex(background_color)) {
        draft.text_color = optHex(parsed.text_color) ?? '#E8ECF2';
        draft.heading_color = optHex(parsed.heading_color) ?? '#FFFFFF';
        draft.muted_color = optHex(parsed.muted_color) ?? '#AEB6C2';
      }
      return draft;
    },
  },

  assistant_chat: {
    system: [
      'You are the business assistant for sellers on Naijavend, a Nigerian social marketplace.',
      'You give short, practical, specific advice grounded ONLY in the store facts provided —',
      'never invent orders, revenue or numbers. Always reply with a single valid JSON object and nothing else.',
    ].join(' '),
    user: (input) =>
      [
        "The seller's store context and chat so far:",
        input,
        'Respond as JSON: {"reply": string}',
        '- 2-5 short sentences (or compact lines), plain text, max ~120 words.',
        '- Be concrete and actionable; reference the store stats when relevant.',
        "- End with one clear next step the seller can take today.",
      ].join('\n'),
    sanitize: (parsed): AiAssistantDraft => {
      const reply = sanitizeMultiline(parsed.reply, 1200);
      if (reply.length < 2) throw new Error('gemini assistant: empty reply');
      return { reply };
    },
  },

  social_post: {
    system: SYSTEM_INSTRUCTION,
    user: (input) =>
      [
        'Draft a social media post for this Nigerian small business:',
        input,
        'Respond as JSON: {"post": string}',
        '- Line breaks are welcome; warm, confident tone; max 1-2 emojis.',
        '- Platform shape: whatsapp = status blast, max ~300 characters, no hashtags;',
        '  instagram = caption with 4-6 hashtags at the end; facebook = friendly community post.',
        '- Mention the store name naturally and end with a clear call to order or book via WhatsApp.',
      ].join('\n'),
    sanitize: (parsed): AiSocialPostDraft => {
      const post = sanitizeMultiline(parsed.post, 900);
      if (post.length < 20) throw new Error('gemini social post: too short');
      return { post };
    },
  },

  image_gen: {
    system: SYSTEM_INSTRUCTION,
    user: (input) =>
      [
        'Generate a single realistic product/store image for this Nigerian small business:',
        input,
        'Return ONLY the image — no text, no explanation.',
      ].join('\n'),
    sanitize: (parsed, input): AiImageDraft => {
      // Image generation is not a sanitize-and-return-text path — the image is
      // generated by the Gemini image model, and the alt text is set by the caller.
      return dummyImageDraft(input);
    },
  },
};

// ---------------------------------------------------------------------------
// Gemini REST client
// ---------------------------------------------------------------------------

interface GeminiApiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { totalTokenCount?: number };
}

interface GeminiImageResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  usageMetadata?: { totalTokenCount?: number };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = GEMINI_DEFAULT_MODEL,
    private readonly fetchImpl: FetchLike = (...args) => fetch(...args),
  ) {}

  async complete(req: AiRequest): Promise<AiResponse> {
    const spec = FEATURES[req.feature];
    const { text, tokensUsed } = await this.callGemini(spec.system, spec.user(req.input));
    const parsed = parseJsonLoose(text);
    return {
      draft: spec.sanitize(parsed, req.input),
      tokensUsed,
      provider: this.name,
    };
  }

  async generateImage(req: AiRequest): Promise<AiImageDraft> {
    const alt = dummyImageDraft(req.input).alt;
    if (!this.apiKey) {
      return { imageUrl: null, alt };
    }
    // Official Gemini image generation guides now use the Interactions API
    // (POST /v1beta/interactions) with a dedicated Nano Banana image model.
    // Use GEMINI_IMAGE_MODEL if set; otherwise fall back to the current
    // recommended image-capable model. Do not reuse the text model id.
    const imageModel =
      this.constructor === GeminiProvider
        ? process.env.GEMINI_IMAGE_MODEL?.trim() ||
          'gemini-nano-banana-2.1' ||
          process.env.GEMINI_MODEL?.trim() ||
          GEMINI_DEFAULT_MODEL
        : (process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-nano-banana-2.1' || this.model);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await this.fetchImpl(
        `${GEMINI_ENDPOINT}/v1beta/interactions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: imageModel,
            input: `Generate a single realistic product/store image for a Nigerian small business. Return ONLY the image — no text, no explanation.\nPrompt: ${req.input.trim().slice(0, 1000)}`,
            response_format: {
              type: 'image',
              mime_type: 'image/png',
              aspect_ratio: '1:1',
              image_size: '1K',
            },
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`gemini image http ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        steps?: Array<{
          type?: string;
          content?: Array<{
            type?: string;
            mime_type?: string;
            data?: string;
          }>;
        }>;
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
      };

      // Modern Interactions API response: image is a base64 blob under steps[].content[].
      const image = data.steps?.flatMap((s) => s.content ?? []).find((part) => part.type === 'image');
      if (image?.data) {
        const b64 = image.data;
        const mime = (image.mime_type ?? 'image/png').startsWith('image/') ? image.mime_type : 'image/png';
        return {
          imageUrl: `data:${mime};base64,${b64}`,
          alt,
        };
      }
      throw new Error('gemini image: no image returned');
    } catch (err) {
      return dummyImageDraft(req.input);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Create an image generation client from env, mirroring `createProviderFromEnv`
   * in packages/ai/src/index.ts but using a possibly-different image model id.
   * Uses the same default image model as createImageProviderFromEnv. */
  static fromEnv(env: Record<string, string | undefined> = process.env): GeminiProvider {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) return new GeminiProvider('');
    // Use the explicit image model when set; otherwise the current recommended
    // Nano Banana image model. Do not fall back to the text model id, because
    // text models do not reliably produce images via this endpoint.
    const imageModel = env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-nano-banana-2.1';
    return new GeminiProvider(apiKey, imageModel);
  }

  private async callGemini(system: string, user: string): Promise<{ text: string; tokensUsed: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await this.fetchImpl(`${GEMINI_ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Header (not ?key=) keeps the API key out of access logs.
          'x-goog-api-key': this.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`gemini http ${res.status}`);
    }
    const data = (await res.json()) as GeminiApiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('gemini returned an empty response');
    const tokensUsed =
      typeof data.usageMetadata?.totalTokenCount === 'number'
        ? data.usageMetadata.totalTokenCount
        : Math.max(12, Math.ceil((user.length + 120) / 4));
    return { text, tokensUsed };
  }
}

/** Deterministic dummy image draft — no real image is generated; the URL points at a
 * small inline SVG placeholder so the UI flow (image bubble + download button) keeps
 * working keyless, and the alt text still names the prompt for the seller. */
export function dummyImageDraft(input: string): AiImageDraft {
  const prompt = input.trim().slice(0, 200).replace(/[\u0000-\u001F]+/g, ' ').trim() || 'product image';
  const label = encodeURIComponent(prompt.slice(0, 48));
  return {
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
      `<rect width="1024" height="1024" fill="#f6f7fb"/>` +
      `<g fill="none" stroke="#c9ced8" stroke-width="2">` +
      `<rect x="140" y="220" width="744" height="584" rx="12"/>` +
      `<circle cx="320" cy="420" r="120"/>` +
      `<circle cx="704" cy="420" r="120"/>` +
      `</g>` +
      `<text x="512" y="760" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#6b7280">AI image (placeholder)</text>` +
      `<text x="512" y="812" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#9aa1ad">${label}</text>` +
      `</svg>`,
    )}`,
    alt: `AI-generated image for: ${prompt}`,
  };
}

/** Tolerant JSON extraction — strips code fences and grabs the outer object. */
function parseJsonLoose(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const raw = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('gemini returned non-JSON output');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('gemini returned non-object JSON');
  }
  return parsed as Record<string, unknown>;
}
