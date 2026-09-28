// Listing media upload — authenticated seller, stored in the public `store-media`
// bucket under {userId}/ so RLS keeps every seller inside their own folder.
// Images ≤ 5 MB; videos (mp4/webm/quicktime) ≤ 60 MB. Video goes through a
// signed direct-to-storage upload because Vercel serverless bodies cap ~4.5 MB.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

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
    const { error } = await sb.storage
      .from('store-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (error) {
      // Supabase enforces the 64 MB bucket cap at the storage layer too —
      // surface its rejection clearly instead of a generic 500.
      if (String(error.message).toLowerCase().includes('payload too large') || String(error.message).toLowerCase().includes('size limit')) {
        return apiError(422, 'too_large', isVideo ? 'Videos must be 60 MB or smaller.' : 'Each image must be 5 MB or smaller.');
      }
      throw error;
    }

    const { data: publicUrl } = sb.storage.from('store-media').getPublicUrl(path);
    return apiOk({ url: publicUrl.publicUrl, kind: isVideo ? 'video' : 'image' }, 201);
  } catch (err) {
    return internalError('listing-media-upload', err);
  }
}
