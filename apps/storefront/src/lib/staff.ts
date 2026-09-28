// Staff context for POS + staff features: resolves the signed-in seller user
// to either the store OWNER or an ACTIVE staff member, and reports whether
// the store is on the growth (tier-2) plan. One query path, used by every
// staff-aware API so the rules can't drift between endpoints.

import type { SupabaseClient } from '@supabase/supabase-js';

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

export async function getStaffContext(sb: SupabaseClient, slug: string): Promise<StaffContext | null> {
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: store } = await sb
    .from('stores')
    .select('id, slug, plan, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!store) return null;

  const s = store as { id: string; slug: string; plan?: string; owner_id?: string };
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
    .select('id, display_name, role, active, stores(id, slug, name, plan)')
    .eq('user_id', uid)
    .maybeSingle();
  if (!row || !(row as { active: boolean }).active) return null;

  const r = row as unknown as {
    id: string; display_name: string; role: string;
    stores: { id: string; slug: string; name: string; plan: string } | { id: string; slug: string; name: string; plan: string }[] | null;
  };
  const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
  if (!store) return null;

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
