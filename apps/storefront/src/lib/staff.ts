// Staff context for POS + staff features: resolves the signed-in seller user
// to either the store OWNER or an ACTIVE staff member, and reports whether
// the store is on the growth (tier-2) plan. One query path, used by every
// staff-aware API so the rules can't drift between endpoints.

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectivePlan } from './plans';
import { supabaseServiceOptional } from './supabase';

type StaffStore = { id: string; slug: string; name: string; plan: string; plan_expires_at?: string | null };

/** Whether this staff row is inside the store's current seat count (earliest-added first). */
async function withinSeats(store: { id: string; plan?: string | null; plan_expires_at?: string | null }, staffId: string): Promise<boolean> {
  const seats = effectivePlan(store).limits.staff;
  const svc = supabaseServiceOptional();
  if (seats == null || !svc) return true;
  const { data: allowed } = await svc
    .from('store_staff')
    .select('id')
    .eq('store_id', store.id)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(seats);
  return !allowed || allowed.some((a) => a.id === staffId);
}

export interface StaffContext {
  storeId: string;
  slug: string;
  /** Store owner (full control) vs staff member (POS + own-task views). */
  isOwner: boolean;
  /** Set when the acting user is staff (their store_staff row id). */
  staffId: string | null;
  staffName: string | null;
  staffRole: 'cashier' | 'manager' | null;
  /** Kept for call-site compatibility. POS & staff are now on EVERY plan,
   * so this is always true — the old growth-plan gate was removed. */
  isGrowth: boolean;
}

/**
 * Server-side owner-page guard (R4). Staff share the seller sign-in but only
 * get POS + Orders; every owner-only dashboard page calls this right after its
 * session check so the redirect happens before any store row is read, rather
 * than relying on the client-side StaffGuard after the shell has rendered.
 */
export async function redirectStaffToPos(sb: SupabaseClient): Promise<void> {
  if (await getStaffMembership(sb)) redirect('/dashboard/pos');
}

export async function getStaffContext(sb: SupabaseClient, slug: string): Promise<StaffContext | null> {
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: store } = await sb
    .from('stores')
    .select('id, slug, plan, plan_expires_at, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!store) return null;

  const s = store as { id: string; slug: string; plan?: string; plan_expires_at?: string | null; owner_id?: string };
  const isGrowth = true; // POS + staff are free for everyone now.
  const isOwner = s.owner_id === uid;

  if (isOwner) {
    return { storeId: s.id, slug, isOwner: true, staffId: null, staffName: null, staffRole: null, isGrowth };
  }

  const { data: staff } = await sb
    .from('store_staff')
    .select('id, display_name, role, active')
    .eq('user_id', uid)
    .eq('store_id', store.id)
    .maybeSingle();
  if (!staff || !(staff as { active: boolean }).active) return null;

  const st = staff as { id: string; display_name: string; role: string };
  if (!(await withinSeats(s, st.id))) return null;
  return {
    storeId: s.id,
    slug,
    isOwner: false,
    staffId: st.id,
    staffName: st.display_name,
    staffRole: st.role === 'manager' ? 'manager' : 'cashier',
    isGrowth,
  };
}

/**
 * The signed-in user's staff membership (if any): their store plus their
 * identity in it. Staff don't own stores, so owner-scoped helpers return
 * null for them — pages use this to render the staff experience instead.
 */
export async function getStaffMembership(
  sb: SupabaseClient
): Promise<{ storeId: string; slug: string; name: string; plan: string; displayName: string; role: 'cashier' | 'manager'; staffId: string } | null> {
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: row } = await sb
    .from('store_staff')
    .select('id, display_name, role, active, stores(id, slug, name, plan, plan_expires_at)')
    .eq('user_id', uid)
    .maybeSingle();
  if (!row || !(row as { active: boolean }).active) return null;

  const r = row as unknown as {
    id: string; display_name: string; role: string;
    stores: StaffStore | StaffStore[] | null;
  };
  const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
  if (!store) return null;

  // Staff seats follow the store's current plan (Free 2, Business 5, Emirates
  // Plus 25). If a plan lapses, only the earliest-added active staff up to the
  // seat count keep access; the rest are paused until the owner renews.
  if (!(await withinSeats(store, r.id))) return null;

  return {
    storeId: store.id,
    slug: store.slug,
    name: store.name,
    plan: store.plan ?? 'free',
    displayName: r.display_name,
    role: r.role === 'manager' ? 'manager' : 'cashier',
    staffId: r.id,
  };
}
