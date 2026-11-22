// Edge-safe session refresh for middleware (23 Nov 2026).
//
// Why: Server Components can't set cookies, so when a page found an expired
// access cookie it redirected mid-render to /api/auth/session-refresh. On
// phones (whose sessions are usually older than the 1-hour access cookie) that
// redirect happened after the page frame had already streamed, and the buyer
// account and seller orders pages could stall showing only the frame and
// footer. Middleware runs before the render and CAN set cookies, so we refresh
// here and hand the page a fresh token; the in-render bounce stays only as a
// fallback.
//
// Cookie names and lifetimes must match lib/auth.ts.

export const SESSION_COOKIES = {
  seller: { access: 'idev_access_token', refresh: 'idev_refresh_token' },
  customer: { access: 'idev_customer_token', refresh: 'idev_customer_refresh_token' },
} as const;
export type SessionRole = keyof typeof SESSION_COOKIES;

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
/** Refresh a little early so the token can't expire during the render. */
const SKEW_SECONDS = 60;

/** Seconds-since-epoch expiry from a JWT, or 0 if unreadable. No signature check: Supabase verifies it later. */
export function jwtExpiry(token: string | undefined): number {
  if (!token) return 0;
  const part = token.split('.')[1];
  if (!part) return 0;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp : 0;
  } catch {
    return 0;
  }
}

export function needsRefresh(access: string | undefined, refresh: string | undefined, nowSec = Date.now() / 1000): boolean {
  if (!refresh) return false;
  return jwtExpiry(access) <= nowSec + SKEW_SECONDS;
}

export interface RefreshedSession {
  access: string;
  refresh: string;
}

/** Exchange a refresh token for a new session via Supabase Auth REST. Null on any failure. */
export async function refreshSessionEdge(refreshToken: string): Promise<RefreshedSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; refresh_token?: string };
    return j.access_token && j.refresh_token ? { access: j.access_token, refresh: j.refresh_token } : null;
  } catch {
    return null;
  }
}

export function cookieOptions(kind: 'access' | 'refresh') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: kind === 'access' ? ACCESS_MAX_AGE : REFRESH_MAX_AGE,
  };
}
