// Listing media upload — authenticated seller, stored in the public `store-media`
// bucket under {userId}/ so RLS keeps every seller inside their own folder.
// Images ≤ 5 MB; videos (mp4/webm/quicktime) ≤ 60 MB. Video goes through a
// signed direct-to-storage upload because Vercel serverless bodies cap ~4.5 MB.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { aiComplete, createProviderFromEnv } from '@idevtenancy/ai';
import { recordFlag } from '@/lib/moderation';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB per video
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  // Uploads unlimited = storage-cost abuse; throttle per IP.
  const rl = rateLimit(`upload:${clientIp(req)}`, 15, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many uploads. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_form', 'Send the file as multipart form data.');
  }

  const file = form.get('file');
  if (!(file instanceof File)) return apiError(422, 'no_file', 'Choose an image or video to upload.');

  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) {
    return apiError(422, 'bad_type', 'Images must be JPEG, PNG, WebP or GIF; videos must be MP4, WebM or MOV.');
  }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return apiError(422, 'too_large', isVideo ? 'Videos must be 60 MB or smaller.' : 'Each image must be 5 MB or smaller.');
  }

  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    const ext = EXTENSIONS[file.type];
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    // Read images into memory ONCE: the same bytes go to storage and to the
    // moderation pass below (a File body can only be consumed a single time).
    const imageBytes = isImage ? Buffer.from(await file.arrayBuffer()) : null;
    const { error } = await sb.storage
      .from('store-media')
      .upload(path, imageBytes ?? file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (error) {
      // Supabase enforces the 64 MB bucket cap at the storage layer too —
      // surface its rejection clearly instead of a generic 500.
      if (String(error.message).toLowerCase().includes('payload too large') || String(error.message).toLowerCase().includes('size limit')) {
        return apiError(422, 'too_large', isVideo ? 'Videos must be 60 MB or smaller.' : 'Each image must be 5 MB or smaller.');
      }
      throw error;
    }

    const { data: publicUrl } = sb.storage.from('store-media').getPublicUrl(path);

    // --- Image moderation --------------------------------------------------
    // Only runs when a vision-capable model is configured: without a key the
    // rules fallback has no eyes, and claiming "flagged: false" from a blind
    // pass would be worse than saying nothing. Hard-NSFW is blocked (file
    // removed); anything else is recorded as a flag for review and the photo
    // stays live for a human to judge.
    let labels: string[] = [];
    let blocked = false;
    if (isImage && imageBytes && createProviderFromEnv().name !== 'dummy') {
      try {
        const verdict = await aiComplete({
          feature: 'moderation',
          input:
            '[Kind] image\n[Text] A seller is uploading a product photo to a Nigerian marketplace. ' +
            'Judge ONLY what is visible: sexually explicit content, graphic violence, hate symbols, or a photo ' +
            'of a private document (bank card, passport, ID, licence). Ordinary product photos are fine.',
          image: { mimeType: file.type, base64: imageBytes.toString('base64') },
        });
        const draft = verdict.draft as { flagged?: boolean; labels?: string[] };
        labels = Array.isArray(draft.labels) ? draft.labels : [];
        blocked = draft.flagged === true && labels.some((l) => l === 'nsfw_image' || l === 'harassment');
      } catch (err) {
        console.warn('[upload-image] moderation pass failed:', err);
      }
    }

    if (blocked) {
      await sb.storage.from('store-media').remove([path]).catch(() => undefined);
      return apiError(422, 'inappropriate_image', 'That photo is not allowed on Naijavend — use a photo of the product itself.');
    }
    if (labels.length > 0) {
      const store = await getOwnStore<{ id: string }>(sb, 'id');
      await recordFlag(sb, {
        storeId: store?.id ?? null,
        kind: 'listing',
        labels,
        excerpt: `Photo flagged on upload: ${labels.join(', ')}`,
        source: 'model',
      });
    }

    return apiOk({ url: publicUrl.publicUrl, kind: isVideo ? 'video' : 'image', ...(labels.length ? { moderation: labels } : {}) }, 201);
  } catch (err) {
    return internalError('listing-media-upload', err);
  }
}
