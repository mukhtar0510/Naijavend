import { createClient } from '@supabase/supabase-js';
import { supabaseServiceOptional } from '@/lib/supabase';

// Admin gate for the standalone console: email + password sign-in against
// Supabase Auth, then the ADMIN_EMAILS allow-list on top. The signed session
// lives in an httpOnly cookie holding the Supabase access token.

export const SESSION_COOKIE = 'idev_admin_token';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Verify an email+password pair against Supabase Auth and the allow-list. */
export async function signInAdmin(
  email: string,
  password: string,
): Promise<{ ok: true; accessToken: string; email: string } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: 'Supabase is not configured on this deployment.' };

  const normalized = email.trim().toLowerCase();
  try {
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } })
      .auth.signInWithPassword({ email: normalized, password });
    if (error || !data.session) {
      return { ok: false, error: 'Invalid email or password.' };
    }
    if (!adminEmails().includes(normalized)) {
      return { ok: false, error: 'This account is not an administrator.' };
    }
    return { ok: true, accessToken: data.session.access_token, email: normalized };
  } catch {
    return { ok: false, error: 'Sign-in failed — try again shortly.' };
  }
}

/** Current admin identity from the session cookie, or null. */
export async function currentAdmin(): Promise<{ email: string } | null> {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const access = jar.get(SESSION_COOKIE)?.value;
  if (!access) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(access);
    if (error || !data.user?.email) return null;
    const email = data.user.email.toLowerCase();
    if (!adminEmails().includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}

export interface AdminActor {
  email: string;
  svc: NonNullable<ReturnType<typeof supabaseServiceOptional>>;
}

/** Gate + service client for admin API routes. Returns a reason on failure. */
export async function requireAdminActor(): Promise<AdminActor | { error: string; status: number }> {
  if (!supabaseServiceOptional()) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on this deployment.', status: 503 };
  }
  const admin = await currentAdmin();
  if (!admin) return { error: 'Not authorised.', status: 403 };
  return { email: admin.email, svc: supabaseServiceOptional()! };
}

/** Append-only audit trail — best-effort, never blocks the action it records. */
export async function audit(
  actorEmail: string,
  action: string,
  target?: { email?: string | null; userId?: string | null },
  details?: Record<string, unknown>,
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
