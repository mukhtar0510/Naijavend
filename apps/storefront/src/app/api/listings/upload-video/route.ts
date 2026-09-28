// Signed direct-to-storage video upload for listings.
// Vercel serverless request bodies cap around 4.5 MB, so videos (up to 60 MB)
// must go browser → Supabase Storage directly. This endpoint only authorises
// the upload: it verifies the seller, mints the object path, and hands back a
// short-lived signed upload URL. The client then PUTs the file to that URL.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`video-upload:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many uploads. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const contentType = typeof b.contentType === 'string' ? b.contentType : '';

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return apiError(422, 'bad_type', 'Videos must be MP4, WebM or MOV.');
  }

  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    const ext = EXTENSIONS[contentType];
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await sb.storage
      .from('store-media')
      .createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('no signed url');

    return apiOk(
      {
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
        // The bucket is public — this is the URL once the upload completes.
        publicUrl: sb.storage.from('store-media').getPublicUrl(path).data.publicUrl,
      },
      201
    );
  } catch (err) {
    return internalError('video-upload-init', err);
  }
}
