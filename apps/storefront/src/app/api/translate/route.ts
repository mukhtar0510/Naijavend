// Translation between English, Pidgin, Yoruba, Hausa and Igbo — used for chat
// bubbles and, in batches, for the visible interface text.
//
// Shape: { texts: string[], lang } → { texts: string[], provider }. Batches
// keep a whole page's UI to a handful of requests, and the caller caches per
// (lang, text) so the cost is paid once per string per language.
import { NextRequest } from 'next/server';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { aiComplete } from '@idevtenancy/ai';
import { isLanguageCode, sanitizeText } from '@idevtenancy/shared';

const MAX_TEXTS = 60;
const MAX_LEN = 600;

export async function POST(req: NextRequest) {
  const rl = rateLimit(`translate:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many translations. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const lang = isLanguageCode(b.lang) ? b.lang : '';
  if (!lang) return apiError(422, 'invalid_lang', 'Choose a language to translate into.');
  if (lang === 'en') return apiOk({ texts: [] as string[], provider: 'noop' });

  const raw = Array.isArray(b.texts) ? b.texts : [];
  const texts = raw
    .map((t) => sanitizeText(t, MAX_LEN))
    .filter((t) => t.length > 1)
    .slice(0, MAX_TEXTS);
  if (texts.length === 0) return apiOk({ texts: [] as string[], provider: 'noop' });

  try {
    // One call for the whole batch (numbered lines keep indexes aligned), so a
    // page costs one request rather than one per string. Newlines inside an
    // item would break the numbering, so the batch is joined with explicit
    // `#n` markers and split back apart afterwards.
    const payload = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const result = await aiComplete({
      feature: 'translation',
      input: `[Lang] ${lang}\n[Text] ${payload.slice(0, 12000)}`,
    });
    const draft = result.draft as { text?: unknown };
    const translated = typeof draft.text === 'string' ? draft.text : '';

    const lines = translated
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);

    // `dummy` (no Gemini key) returns the input unchanged — report the provider
    // so the UI can skip calling it a translation.
    return apiOk({
      texts: lines.length >= texts.length ? lines.slice(0, texts.length) : texts,
      provider: result.provider,
    });
  } catch (err) {
    return internalError('translate', err);
  }
}