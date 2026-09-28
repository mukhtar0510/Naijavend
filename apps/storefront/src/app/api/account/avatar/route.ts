// Customer avatar upload — authenticated customer, stored in the public
// `avatars` bucket under {userId}/ so RLS keeps every customer inside their own
// folder (mirrors the seller store-media upload route). Images ≤ 2 MB; the
// avatar renders small everywhere, so large files are pointless weight.
import { NextRequest } from 'next/server';
import { getCustomerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const sb = await getCustomerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`avatar-upload:${clientIp(req)}`, 10, 60_000);
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
  if (!(file instanceof File)) return apiError(422, 'no_file', 'Choose an image to upload.');
  if (!AVATAR_TYPES.has(file.type)) {
    return apiError(422, 'bad_type', 'Avatars must be JPEG, PNG or WebP.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return apiError(422, 'too_large', 'Avatars must be 2 MB or smaller.');
  }

  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    const ext = EXTENSIONS[file.type];
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;

    const { data: publicUrl } = sb.storage.from('avatars').getPublicUrl(path);
    return apiOk({ url: publicUrl.publicUrl }, 201);
  } catch (err) {
    return internalError('avatar-upload', err);
  }
}
