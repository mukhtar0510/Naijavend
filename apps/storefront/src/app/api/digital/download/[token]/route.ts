// Secure digital delivery: the buyer hits /api/digital/download/<token>
// (token minted by the DB trigger when their order is paid). One-time use:
// we flip token_used_at before serving, so replays burn a clean 410.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/ratelimit';

const TOKEN_RE = /^[0-9a-f]{64}$/;

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const rl = rateLimit(`dl:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: { code: 'rate_limited', message: `Too many downloads. Wait ${rl.retryAfterSeconds}s.` } }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const token = params.token ?? '';
  if (!TOKEN_RE.test(token)) {
    return new Response(JSON.stringify({ error: { code: 'bad_token', message: 'This download link is not valid.' } }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const sb = supabaseService();
  try {
    // Atomically claim the token: only the FIRST caller gets used_at is null.
    const claimed = await sb
      .from('digital_deliveries')
      .update({ token_used_at: new Date().toISOString() })
      .eq('download_token', token)
      .is('token_used_at', null)
      .select('id, listing_id, store_id, buyer_email')
      .maybeSingle();

    const row = (claimed as { data: { id: string; listing_id: string; store_id: string; buyer_email: string } | null; error: unknown }).data;
    if (!row) {
      return new Response(JSON.stringify({ error: { code: 'token_used', message: 'This download link was already used. Reply to the order message and the seller will re-issue it.' } }), {
        status: 410,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Read the listing via service role (bounded columns only).
    const { data: listing, error: listErr } = await sb
      .from('listings')
      .select('digital_file_path, digital_file_name')
      .eq('id', row.listing_id)
      .maybeSingle();
    if (listErr || !listing?.digital_file_path) {
      return new Response(JSON.stringify({ error: { code: 'missing_file', message: 'The file for this order is missing. Contact the seller.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Storage: private deliverable — no public URL is minted for store-media
    // digital paths; we build the signed URL here, server-side, 15-minute TTL.
    const { data: signed, error: signErr } = await sb.storage
      .from('store-media')
      .createSignedUrl(listing.digital_file_path, 15 * 60, { transform: undefined });
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: { code: 'storage_error', message: 'The file is temporarily unavailable. Try again shortly.' } }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }

    return Response.redirect(signed.signedUrl, 307);
  } catch (err) {
    console.error('[Naijavend] digital-download:', err);
    return new Response(JSON.stringify({ error: { code: 'internal_error', message: 'Something failed on our side. Try again shortly.' } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
