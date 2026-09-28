// Seller auth — Supabase OAuth sessions (Google) via /auth/callback, which
// hands verified tokens to /api/auth/oauth-session to set these cookies.
// backend skill #48). Session travels via the access token in a httpOnly cookie set
// by the server after signIn; server components verify it against Supabase.
//
// Two roles share one Supabase auth project but keep SEPARATE cookies so a user can
// be signed in as a seller and a customer (or either) independently:
//   - seller cookies: idev_access_token / idev_refresh_token
//   - customer cookies: idev_customer_token / idev_customer_refresh_token

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ACCESS_TOKEN_COOKIE = 'idev_access_token';
export const REFRESH_TOKEN_COOKIE = 'idev_refresh_token';
const CUSTOMER_TOKEN_COOKIE = 'idev_customer_token';
export const CUSTOMER_REFRESH_COOKIE = 'idev_customer_refresh_token';

/**
 * Next 14 forbids cookie mutation during Server Component renders ("Cookies
 * can only be modified in a Server Action or Route Handler") — a set() there
 * throws and 500s the whole page. Probe writability lazily so we never attempt
 * (and crash on) a cookie write from render context. Only probed when a
 * refresh is actually needed, so the hot path (valid access cookie) never
 * touches this.
 */
function makeWritabilityProbe(jar: Awaited<ReturnType<typeof cookies>>) {
  let cached: boolean | null = null;
  return () => {
    if (cached === null) {
      try {
        jar.set('__idev_probe', '1', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 5 });
        jar.delete('__idev_probe');
        cached = true;
      } catch {
        cached = false;
      }
    }
    return cached;
  };
}

/**
 * Refresh tokens are single-use: consuming one without persisting the rotated
 * replacement strands the session (the next use of the stale token looks like
 * token theft and revokes the family). So in a read-only render context we do
 * NOT refresh inline — bounce through /api/auth/session-refresh, a route
 * handler that refreshes + persists the cookies legally, then redirects back.
 */
function bounceToSessionRefresh(role: 'seller' | 'customer', headers: Headers): never {
  // headers.get('next-url') is the RSC request's page URL (the "Next-Url"
  // header) — enough to land the user back on the page they wanted.
  const page = headers.get('next-url') ?? '';
  const next = /^\/(dashboard|account)(\/|$)/.test(page) && !page.includes('\\') ? `&next=${encodeURIComponent(page)}` : '';
  redirect(`/api/auth/session-refresh?role=${role}${next}`);
}

export function supabaseAuthClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars.');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
  // Access token: short-lived by design (1h). Refresh: 30 days from each
  // refresh — a Google-signed-in seller stays logged in with normal use.
  jar.set(ACCESS_TOKEN_COOKIE, accessToken, { ...opts, maxAge: 60 * 60 });
  jar.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
}

/** Returns a Supabase client acting as the signed-in seller, or null. Refreshes expired tokens. */
export async function getSellerClient(): Promise<SupabaseClient | null> {
  const jar = await cookies();
  const hdrs = headers();
  let access = jar.get(ACCESS_TOKEN_COOKIE)?.value;
  let refresh = jar.get(REFRESH_TOKEN_COOKIE)?.value;

  const sb = supabaseAuthClient();
  const canPersist = makeWritabilityProbe(jar);

  // No access cookie does NOT mean logged out: the access cookie lives 1h but
  // the refresh cookie lives 30 days. If only the refresh token survives,
  // mint a fresh session from it (this is the bug that forced a re-login
  // every hour: we used to bail out before ever trying the refresh token).
  if (!access) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('seller', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    access = refreshed.session.access_token;
    refresh = refreshed.session.refresh_token;
    await setSessionCookies(access, refresh);
  }

  // Verify token; refresh if expired. Supabase rotates refresh tokens on use —
  // persisting the new one keeps the 30-day sliding window alive (otherwise a
  // session dies the first time the access token expires).
  const { data: userData, error } = await sb.auth.getUser(access);
  if (error || !userData.user) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('seller', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    access = refreshed.session.access_token;
    refresh = refreshed.session.refresh_token;
    await setSessionCookies(access, refresh);
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${access}` } },
    }
  );
}

export async function requireSeller(): Promise<SupabaseClient> {
  const client = await getSellerClient();
  if (!client) throw new Error('UNAUTHENTICATED');
  return client;
}

/**
 * The signed-in seller's OWN store row. Always owner-scoped: the public-read
 * policy makes every store visible to authenticated clients, so unfiltered
 * `.maybeSingle()` queries 406 (multiple rows) and silently return null.
 */
export async function getOwnStore<T = Record<string, unknown>>(
  sb: SupabaseClient,
  select = '*'
): Promise<T | null> {
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await sb.from('stores').select(select).eq('owner_id', uid).maybeSingle();
  return (data as T | null) ?? null;
}

// ============ customer auth ============

export async function setCustomerSessionCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
  jar.set(CUSTOMER_TOKEN_COOKIE, accessToken, { ...opts, maxAge: 60 * 60 });
  jar.set(CUSTOMER_REFRESH_COOKIE, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearCustomerSessionCookies() {
  const jar = await cookies();
  jar.delete(CUSTOMER_TOKEN_COOKIE);
  jar.delete(CUSTOMER_REFRESH_COOKIE);
}

export interface CustomerIdentity {
  id: string;
  email: string;
}

/** Returns a Supabase client acting as the signed-in customer (RLS-scoped to their own rows), or null. */
export async function getCustomerClient(): Promise<SupabaseClient | null> {
  const jar = await cookies();
  const hdrs = headers();
  let access = jar.get(CUSTOMER_TOKEN_COOKIE)?.value;
  let refresh = jar.get(CUSTOMER_REFRESH_COOKIE)?.value;

  const sb = supabaseAuthClient();
  const canPersist = makeWritabilityProbe(jar);
  // Same fix as the seller path: an evicted 1h access cookie is not a logout —
  // recover from the 30-day refresh token before giving up.
  if (!access) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('customer', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    access = refreshed.session.access_token;
    refresh = refreshed.session.refresh_token;
    await setCustomerSessionCookies(access, refresh);
  }
  // Same rotation story as the seller session above.
  const { data: userData, error } = await sb.auth.getUser(access);
  if (error || !userData.user) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('customer', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    access = refreshed.session.access_token;
    refresh = refreshed.session.refresh_token;
    await setCustomerSessionCookies(access, refresh);
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${access}` } },
    }
  );
}

/** Returns the signed-in customer's identity, refreshing an expired session once. */
export async function getCustomerUser(): Promise<CustomerIdentity | null> {
  const jar = await cookies();
  const hdrs = headers();
  let access = jar.get(CUSTOMER_TOKEN_COOKIE)?.value;
  let refresh = jar.get(CUSTOMER_REFRESH_COOKIE)?.value;

  const sb = supabaseAuthClient();
  const canPersist = makeWritabilityProbe(jar);
  // Recover from an evicted access cookie via the refresh token (see above).
  if (!access) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('customer', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    await setCustomerSessionCookies(refreshed.session.access_token, refreshed.session.refresh_token);
    return { id: refreshed.session.user.id, email: refreshed.session.user.email ?? '' };
  }
  const { data: userData, error } = await sb.auth.getUser(access);
  if (error || !userData.user) {
    if (!refresh) return null;
    if (!canPersist()) bounceToSessionRefresh('customer', hdrs);
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession({ refresh_token: refresh });
    if (refreshErr || !refreshed.session) return null;
    access = refreshed.session.access_token;
    await setCustomerSessionCookies(refreshed.session.access_token, refreshed.session.refresh_token);
    return { id: refreshed.session.user.id, email: refreshed.session.user.email ?? '' };
  }
  return { id: userData.user.id, email: userData.user.email ?? '' };
}
