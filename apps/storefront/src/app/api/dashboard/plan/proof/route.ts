// Seller uploads the transfer receipt for a plan purchase. Same file rules as
// order receipts (JPG/PNG/WebP/PDF, 5 MB). Moves the purchase to
// awaiting_confirmation for the owner to check in /admin.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export async function POST(req: NextRequest) {
  const rl = rateLimit(`plan-proof:${clientIp(req)}`, 6, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many uploads. Try again in ${rl.retryAfterSeconds}s.`);
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_body', 'Upload the receipt as form data.');
  }
  const id = String(form.get('id') ?? '');
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid', 'Invalid purchase.');
  if (!(file instanceof File) || file.size === 0) return apiError(422, 'missing_file', 'Choose a receipt to upload.');
  if (file.size > MAX_BYTES) return apiError(413, 'too_large', 'Keep the receipt under 5 MB.');
  const ext = ALLOWED[file.type];
  if (!ext) return apiError(415, 'unsupported_type', 'Upload a JPG, PNG, WebP image or a PDF.');

  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(403, 'no_store', 'Only the store owner can do this.');
    const svc = supabaseService();
    const { data: pay } = await svc.from('plan_payments').select('id, status').eq('id', id).eq('store_id', store.id).maybeSingle();
    if (!pay) return apiError(404, 'not_found', 'Purchase not found.');
    if (!['pending', 'awaiting_confirmation'].includes(pay.status)) return apiError(409, 'closed', 'This purchase is already settled.');

    const path = `plan-proofs/${store.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await svc.storage.from('store-media').upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) return apiError(502, 'upload_failed', 'Could not store that receipt. Try again.');
    const url = svc.storage.from('store-media').getPublicUrl(path).data.publicUrl;
    const { error } = await svc.from('plan_payments').update({ proof_url: url, status: 'awaiting_confirmation' }).eq('id', id);
    if (error) {
      await svc.storage.from('store-media').remove([path]).catch(() => undefined);
      throw error;
    }
    return apiOk({ uploaded: true });
  } catch (err) {
    return internalError('plan-proof', err);
  }
}
