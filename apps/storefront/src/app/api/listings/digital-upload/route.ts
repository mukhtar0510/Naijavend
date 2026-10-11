// Upload a digital product file (ebook, code zip, etc.) for a listing.
// Owner-only via seller client; writes into the store-media bucket under a
// private per-store subfolder, limits to 50 MB and a safe whitelist of
// extensions, and attaches the resulting storage path to the given listing.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { revalidateStore } from '@/lib/revalidate';

const ALLOWED_EXT = new Set(['pdf', 'epub', 'mobi', 'zip', 'txt', 'md', 'csv', 'doc', 'docx', 'mp3', 'wav', 'mp4']);
const MAX_BYTES = 50 * 1024 * 1024; // matches digital_file_size check in migration

export async function POST(req: NextRequest) {
  const rl = rateLimit(`digital-upload:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many uploads. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_form', 'Send the file as multipart/form-data.');
  }
  const listingId = String(form.get('listingId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return apiError(400, 'invalid_listing', 'Invalid listing id.');

  const file = form.get('file');
  if (!(file instanceof File)) return apiError(422, 'no_file', 'Attach the file you want to sell.');
  if (file.size === 0) return apiError(422, 'empty_file', 'That file is empty.');
  if (file.size > MAX_BYTES) return apiError(413, 'too_large', 'Files up to 50 MB, please.');

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return apiError(422, 'bad_type', `Allowed types: ${Array.from(ALLOWED_EXT).join(', ')}.`);
  }

  // Confirm the listing belongs to this store AND is a digital listing before
  // we touch storage (ownership is enforced again by the RLS update below).
  const { data: listing, error: listErr } = await sb
    .from('listings')
    .select('id, type, digital_file_path')
    .eq('id', listingId)
    .eq('store_id', (store as { id: string }).id)
    .maybeSingle();
  if (listErr) return internalError('digital-upload-listing', listErr);
  if (!listing) return apiError(404, 'listing_not_found', 'Listing not found in your store.');
  if (listing.type !== 'digital') {
    return apiError(422, 'not_digital', 'Switch the listing type to Digital before attaching a file.');
  }

  const path = `digital/${(store as { id: string }).id}/${listingId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await sb.storage
    .from('store-media')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false, cacheControl: 'private' });
  if (upErr) return internalError('digital-upload-storage', upErr);

  // Best-effort cleanup of the previous file when replacing one.
  if (typeof listing.digital_file_path === 'string' && listing.digital_file_path && listing.digital_file_path !== path) {
    try {
      await sb.storage.from('store-media').remove([listing.digital_file_path]);
    } catch {
      // old file may already be gone; not fatal
    }
  }

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || `file.${ext}`;
  const { error: updErr } = await sb
    .from('listings')
    .update({ digital_file_path: path, digital_file_name: safeName, digital_file_size: file.size })
    .eq('id', listingId)
    .eq('store_id', (store as { id: string }).id);
  if (updErr) return internalError('digital-upload-attach', updErr);

  revalidateStore((store as { slug: string }).slug);
  return apiOk({ path, fileName: safeName, size: file.size }, 201);
}
