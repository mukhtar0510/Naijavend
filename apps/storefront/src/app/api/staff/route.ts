// staff — manage people under a tier-2 seller.
// Owner-only, growth-plan-gated. Staff are real Supabase auth users (they get
// their own seller sign-in) linked to the owner's store via store_staff.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { getSellerClient } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

async function ownerGate(slug: string) {
  const sb = await getSellerClient();
  if (!sb) return { error: apiError(401, 'unauthenticated', 'Sign in first.') as unknown as Response };
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id ?? '';
  const { data: store } = await sb
    .from('stores')
    .select('id, plan')
    .eq('owner_id', uid)
    .eq('slug', slug)
    .maybeSingle();
  if (!store) return { error: apiError(403, 'not_owner', 'Only the store owner can manage staff.') as unknown as Response };
  // POS & staff are free for everyone now — the old growth-plan gate is gone.
  return { sb: supabaseService(), storeId: store.id as string, uid };
}

export async function GET(req: NextRequest) {
  const slug = sanitizeText(new URL(req.url).searchParams.get('slug') ?? '', 80);
  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  const gate = await ownerGate(slug);
  if ('error' in gate) return gate.error;
  try {
    const { data, error } = await gate.sb
      .from('store_staff')
      .select('id, display_name, role, active, created_at')
      .eq('store_id', gate.storeId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return apiOk({ staff: data ?? [] });
  } catch (err) {
    return internalError('staff/list', err);
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`staff-add:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many requests. Try again in ${rl.retryAfterSeconds}s.`);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const name = sanitizeText(b.name, 80);
  const email = sanitizeText(b.email, 160).toLowerCase();
  const role = b.role === 'manager' ? 'manager' : 'cashier';
  // Optional branch tags: staff work every branch when the list is empty.
  const locationIds = Array.isArray(b.locationIds)
    ? [...new Set(b.locationIds.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 10)
    : [];
  const tempPassword = `Nv-${Math.random().toString(36).slice(2, 10)}!7`;

  if (!slug) return apiError(400, 'missing_store', 'Store is required.');
  if (name.length < 2) return apiError(422, 'invalid_name', 'Enter the staff member’s name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError(422, 'invalid_email', 'Enter a valid email address.');

  const gate = await ownerGate(slug);
  if ('error' in gate) return gate.error;

  try {
    // 1. Create the auth user (service role can admin-create without email confirmation).
    const { data: created, error: createErr } = await gate.sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: name, staff_for: slug },
    });
    if (createErr) {
      const msg = createErr.message.includes('already')
        ? 'That email already has an account — ask them to sign in instead.'
        : 'Could not create the staff account.';
      return apiError(422, 'create_failed', msg);
    }
    const uid = created.user!.id;

    // 2. Link them to the store with a role (and optional branch tags).
    const { data: row, error: rowErr } = await gate.sb
      .from('store_staff')
      .insert({ store_id: gate.storeId, user_id: uid, display_name: name, role, created_by: gate.uid, location_ids: locationIds })
      .select('id, display_name, role, active')
      .single();
    if (rowErr) {
      // Clean up the orphan auth user so retry works cleanly.
      await gate.sb.auth.admin.deleteUser(uid);
      throw rowErr;
    }

    return apiOk({ staff: row, tempPassword }, 201);
  } catch (err) {
    return internalError('staff/add', err);
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const staffId = sanitizeText(b.staffId, 60);
  const active = b.active === true;

  if (!slug || !staffId) return apiError(400, 'missing_fields', 'Store and staff member are required.');

  const gate = await ownerGate(slug);
  if ('error' in gate) return gate.error;

  try {
    const { error } = await gate.sb.from('store_staff').update({ active }).eq('id', staffId).eq('store_id', gate.storeId);
    if (error) throw error;
    return apiOk({ ok: true });
  } catch (err) {
    return internalError('staff/toggle', err);
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const staffId = sanitizeText(b.staffId, 60);
  if (!slug || !staffId) return apiError(400, 'missing_fields', 'Store and staff member are required.');

  const gate = await ownerGate(slug);
  if ('error' in gate) return gate.error;

  try {
    // Find the auth user first so the account goes too (revokes their sign-in).
    const { data: row } = await gate.sb.from('store_staff').select('user_id').eq('id', staffId).eq('store_id', gate.storeId).maybeSingle();
    const { error } = await gate.sb.from('store_staff').delete().eq('id', staffId).eq('store_id', gate.storeId);
    if (error) throw error;
    if (row) await gate.sb.auth.admin.deleteUser((row as { user_id: string }).user_id);
    return apiOk({ ok: true });
  } catch (err) {
    return internalError('staff/remove', err);
  }
}
