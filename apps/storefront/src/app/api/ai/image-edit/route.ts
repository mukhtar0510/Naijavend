// Image tools for sellers — background removal and photo clean-up (auto-crop,
// straighten, brighten) on a photo already uploaded to the store-media bucket.
//
// Flow: allow-listed fetch (lib/bucket-image — never an arbitrary URL) → the
// Gemini image model edits it → the result is written back into the seller's
// own storage folder and returned as a public URL they can attach to a listing.
// Without a model key the route says so instead of returning a fake result.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { createImageProviderFromEnv } from '@idevtenancy/ai';
import { loadBucketImage } from '@/lib/bucket-image';

const ACTIONS = {
  'remove-background': {
    prompt:
      'Remove the background from this product photo and replace it with a clean, plain white background. ' +
      'Keep the product exactly as photographed: same shape, same colours, same proportions, no new objects, no text, no logos. ' +
      'Keep the product centred with a little white space around it.',
    out: 'remove-bg',
  },
  enhance: {
    prompt:
      'Clean up this product photo for a marketplace listing: crop tightly around the product, straighten it, ' +
      'remove stray shadows and sensor noise, and brighten it slightly. ' +
      'Do not change the product itself, its colour, or its proportions. No text, no watermark, no new objects.',
    out: 'enhance',
  },
} as const;

type Action = keyof typeof ACTIONS;

const isAction = (v: unknown): v is Action => typeof v === 'string' && v in ACTIONS;

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  // Image edits hit a paid image model and write to storage — throttle hard.
  const rl = rateLimit(`image-edit:${clientIp(req)}`, 8, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Give it ${rl.retryAfterSeconds}s between edits.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const action = b.action as unknown;
  if (!isAction(action)) {
    return apiError(422, 'invalid_action', 'Choose “remove background” or “clean up photo”.');
  }

  try {
    const provider = createImageProviderFromEnv();
    if (!provider) {
      return apiError(400, 'no_image_model', 'Image tools need a model key on this deployment (GEMINI_API_KEY).');
    }

    const source = await loadBucketImage(b.url);
    if (!source) {
      return apiError(422, 'bad_image', 'That image is not in your store media (or is not a supported photo).');
    }

    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    const spec = ACTIONS[action];
    const startedAt = Date.now();
    const edited = await provider.editImage(source, spec.prompt);
    const imageUrl = edited.imageUrl;
    if (!imageUrl || !imageUrl.startsWith('data:image')) {
      return apiError(502, 'edit_failed', 'The edit came back empty — try a different photo or try again shortly.');
    }

    // Persist into the seller's own folder (RLS scopes writes to {userId}/…).
    const [meta, dataPart] = imageUrl.split(',');
    const mime = /^data:(image\/[a-z+]+);base64$/i.exec(meta ?? '')?.[1] ?? 'image/png';
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const buffer = Buffer.from(dataPart ?? '', 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
      return apiError(502, 'edit_failed', 'The edited image was too large to save — try a smaller photo.');
    }

    const path = `${userId}/ai/${Date.now()}-${sanitizeText(spec.out, 20)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await sb.storage
      .from('store-media')
      .upload(path, buffer, { contentType: mime, cacheControl: '31536000', upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: publicUrl } = sb.storage.from('store-media').getPublicUrl(path);

    const { data: authRow } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: null,
      feature: 'image_gen',
      input: `image-edit:${action}`,
      tokens_used: 0,
      provider: 'image-edit',
      user_id: authRow.user?.id ?? null,
      latency_ms: Date.now() - startedAt,
    });

    return apiOk({ url: publicUrl.publicUrl, action, edited: true });
  } catch (err) {
    return internalError('ai-image-edit', err);
  }
}