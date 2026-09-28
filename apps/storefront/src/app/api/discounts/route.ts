// Discount codes — authenticated seller, RLS scopes everything to their own store.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

export async function GET() {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  try {
    const { data, error } = await sb
      .from('discount_codes')
      .select('id, code, percent_off, active, usage_count, max_uses, created_at')
      .eq('store_id', (store as { id: string }).id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return apiOk({ codes: data ?? [] });
  } catch (err) {
    return internalError('discounts-get', err);
  }
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');
  const storeId = (store as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const code = sanitizeText(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const percentOff = Math.round(Number(b.percentOff));
  const maxUses = b.maxUses == null || b.maxUses === '' ? null : Math.round(Number(b.maxUses));

  if (code.length < 3) return apiError(422, 'invalid_code', 'Codes need at least 3 letters, numbers or dashes.');
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 90) {
    return apiError(422, 'invalid_percent', 'Discount must be between 1% and 90%.');
  }
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return apiError(422, 'invalid_max_uses', 'Usage limit must be at least 1, or leave empty for unlimited.');
  }

  try {
    const { error } = await sb.from('discount_codes').insert({ store_id: storeId, code, percent_off: percentOff, max_uses: maxUses });
    if (error) {
      if (String(error.message).includes('duplicate key')) {
        return apiError(409, 'code_exists', 'You already have a code with that name.');
      }
      throw error;
    }
    return apiOk({ created: true }, 201);
  } catch (err) {
    return internalError('discounts-post', err);
  }
}

export async function PATCH(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const id = sanitizeText(b.id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid_id', 'Invalid discount id.');
  const active = b.active === true;

  try {
    const { error } = await sb
      .from('discount_codes')
      .update({ active })
      .eq('id', id)
      .eq('store_id', (store as { id: string }).id);
    if (error) throw error;
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('discounts-patch', err);
  }
}

export async function DELETE(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string }>(sb, 'id');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid_id', 'Invalid discount id.');

  try {
    const { error } = await sb.from('discount_codes').delete().eq('id', id).eq('store_id', (store as { id: string }).id);
    if (error) throw error;
    return apiOk({ deleted: true });
  } catch (err) {
    return internalError('discounts-delete', err);
  }
}
