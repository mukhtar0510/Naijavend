// T04: a buyer uploads a bank-transfer receipt. Authorisation is either the
// signed-in customer who owns the order or the single-purpose payment token
// minted when the order was created — guests have no account, so the token is
// what stops a stranger attaching files to someone else's order.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getCustomerUser } from '@/lib/auth';
import { verifyPayToken } from '@/lib/paytoken';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';

const MAX_BYTES = 5 * 1024 * 1024; // Vercel serverless body cap is ~4.5 MB.
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function POST(req: NextRequest) {
  const rl = rateLimit(`proof:${clientIp(req)}`, 6, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many uploads. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_body', 'Upload the receipt as form data.');
  }

  const orderId = String(form.get('orderId') ?? '');
  const token = String(form.get('token') ?? '');
  const file = form.get('file');

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError(400, 'invalid_order', 'Invalid order.');
  if (!(file instanceof File)) return apiError(422, 'missing_file', 'Choose a receipt to upload.');
  if (file.size === 0) return apiError(422, 'empty_file', 'That file is empty.');
  if (file.size > MAX_BYTES) return apiError(413, 'too_large', 'Keep the receipt under 5 MB.');

  const ext = ALLOWED[file.type];
  if (!ext) return apiError(415, 'unsupported_type', 'Upload a JPG, PNG, WebP image or a PDF.');

  try {
    const sb = supabaseService();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, customer_id, payment_status')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return apiError(404, 'order_not_found', 'Order not found.');

    const customer = await getCustomerUser();
    const ownsAsCustomer = Boolean(customer && order.customer_id && customer.id === order.customer_id);
    const hasToken = verifyPayToken(orderId, token);
    if (!ownsAsCustomer && !hasToken) {
      return apiError(403, 'not_allowed', 'This order link is not valid for uploads.');
    }

    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return apiError(409, 'already_settled', 'This order is already settled.');
    }

    const path = `payment-proofs/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await sb.storage
      .from('store-media')
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadErr) {
      return apiError(502, 'upload_failed', 'Could not store that receipt. Try again.');
    }

    const { data: publicUrl } = sb.storage.from('store-media').getPublicUrl(path);
    const url = publicUrl.publicUrl;

    const { error: updateErr } = await sb
      .from('orders')
      .update({ payment_proof_url: url, payment_status: 'awaiting_confirmation' })
      .eq('id', orderId);

    if (updateErr) {
      // Column missing = migration not applied. Remove the orphan upload so the
      // bucket does not fill with files nothing references.
      await sb.storage.from('store-media').remove([path]).catch(() => undefined);
      const notReady = /does not exist|schema cache/i.test(updateErr.message);
      return apiError(
        notReady ? 503 : 500,
        notReady ? 'migration_pending' : 'proof_save_failed',
        notReady
          ? 'Receipt upload is not enabled on this database yet. Send it to the seller on WhatsApp instead.'
          : 'Could not attach that receipt.'
      );
    }

    return apiOk({ url });
  } catch (err) {
    return internalError('orders-proof', err);
  }
}
