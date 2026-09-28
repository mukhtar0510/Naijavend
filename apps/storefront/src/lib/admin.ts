// Superadmin gate + helpers. The gate is the ADMIN_EMAILS env var (comma-separated,
// case-insensitive) — the signed-in user must present EITHER a customer or a
// seller session whose email is on the list. Destructive and metric operations
// run through the service-role key, so they only work where that key exists
// (production; local dev needs it pasted into .env.local).
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseServiceOptional } from '@/lib/supabase';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function currentSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  const access =
    jar.get('idev_customer_token')?.value ?? jar.get('idev_access_token')?.value;
  if (!access) return null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(access);
    if (error || !data.user) return null;
    return data.user.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** True when the current session belongs to a listed admin. */
export async function isAdmin(): Promise<boolean> {
  const email = await currentSessionEmail();
  if (!email) return false;
  return adminEmails().includes(email);
}

export interface AdminActor {
  email: string;
  svc: NonNullable<ReturnType<typeof supabaseServiceOptional>>;
}

/** Gate + service client for admin API routes. Returns a reason string on failure. */
export async function requireAdminActor(): Promise<AdminActor | { error: string; status: number }> {
  if (!supabaseServiceOptional()) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on this deployment.', status: 503 };
  }
  const email = await currentSessionEmail();
  if (!email || !adminEmails().includes(email)) {
    return { error: 'Not authorised.', status: 403 };
  }
  return { email, svc: supabaseServiceOptional()! };
}

/** Append-only audit trail — best-effort, never blocks the action it records. */
export async function audit(
  actorEmail: string,
  action: string,
  target?: { email?: string | null; userId?: string | null },
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const svc = supabaseServiceOptional();
    if (!svc) return;
    await svc.from('admin_audit_log').insert({
      actor_email: actorEmail,
      action,
      target_email: target?.email ?? null,
      target_user_id: target?.userId ?? null,
      details: details ?? null,
    });
  } catch {
    // Audit failures must never break the admin action itself.
  }
}
