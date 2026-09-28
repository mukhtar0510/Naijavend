// Chat messages — sellers read/write any thread on their own store (RLS via
// stores.owner_id); signed-in customers read/write their own thread
// (customer_id = auth.uid()). Anonymous visitors get a clear 401.
import { NextRequest } from 'next/server';
import { getSellerClient, getCustomerClient, getCustomerUser } from '@/lib/auth';

/** True when the signed-in seller owns `storeId` (public-read means an id
 * filter alone would match ANY store — ownership must be explicit). */
async function sellerOwnsStore(sb: Awaited<ReturnType<typeof getSellerClient>>, storeId: string): Promise<boolean> {
  if (!sb) return false;
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return false;
  const { data } = await sb.from('stores').select('id').eq('id', storeId).eq('owner_id', uid).maybeSingle();
  return !!data;
}
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

function roleError() {
  return apiError(401, 'sign_in_required', 'Sign in (as a customer or the seller) to use chat. You can also reach the store on WhatsApp.');
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(`chat-get:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many requests. Try again in ${rl.retryAfterSeconds}s.`);

  const storeId = req.nextUrl.searchParams.get('storeId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');

  try {
    // Seller?
    const seller = await getSellerClient();
    if (seller && (await sellerOwnsStore(seller, storeId))) {
      const { data, error } = await seller
        .from('chat_messages')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return apiOk({ role: 'seller', messages: data ?? [] });
    }

    // Customer? (must query with their own JWT — RLS scopes rows to auth.uid())
    const customerSb = await getCustomerClient();
    if (customerSb) {
      const { data, error } = await customerSb
        .from('chat_messages')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return apiOk({ role: 'customer', messages: data ?? [] });
    }

    return roleError();
  } catch (err) {
    return internalError('chat-get', err);
  }
}

export async function POST(req: NextRequest) {
  // Chat is a two-way messaging channel — throttle it so a client can't flood
  // a seller (or buyer) with 1000-char messages at wire speed.
  const rl = rateLimit(`chat-post:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Slow down. Try again in ${rl.retryAfterSeconds}s.`);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const storeId = sanitizeText(b.storeId, 40);
  const text = sanitizeText(b.body, 1000);
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');
  if (!text) return apiError(422, 'empty_message', 'Write a message first.');

  try {
    // Seller reply?
    const seller = await getSellerClient();
    if (seller && (await sellerOwnsStore(seller, storeId))) {
      const customerId = typeof b.customerId === 'string' && /^[0-9a-f-]{36}$/i.test(b.customerId) ? b.customerId : null;
      const { data, error } = await seller
        .from('chat_messages')
        .insert({ store_id: storeId, customer_id: customerId, sender: 'seller', body: text })
        .select('*')
        .single();
      if (error) throw error;
      return apiOk({ role: 'seller', message: data }, 201);
    }

    // Customer message? (insert through their own JWT so RLS stamps customer_id)
    const customerSb = await getCustomerClient();
    if (customerSb) {
      const { data: userRow } = await customerSb.auth.getUser();
      const { data, error } = await customerSb
        .from('chat_messages')
        .insert({ store_id: storeId, customer_id: userRow.user?.id ?? null, sender: 'customer', body: text })
        .select('*')
        .single();
      if (error) throw error;
      return apiOk({ role: 'customer', message: data }, 201);
    }

    return roleError();
  } catch (err) {
    return internalError('chat-post', err);
  }
}
