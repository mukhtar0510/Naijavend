// Email + password sign-in for the standalone admin. Verifies credentials via
// Supabase Auth, checks the ADMIN_EMAILS allow-list, then sets an httpOnly
// session cookie holding the Supabase access token.
import { NextRequest, NextResponse } from 'next/server';
import { signInAdmin, SESSION_COOKIE } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

// Brute-force guard: 5 attempts per IP per 10 minutes (per server instance).
const attempts = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > 5;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (limited(ip)) return apiError(429, 'rate_limited', 'Too many sign-in attempts. Wait 10 minutes.');
  let email = '';
  let password = '';
  try {
    const body = await req.json();
    email = typeof body.email === 'string' ? body.email : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  if (!email || !password) return apiError(400, 'missing_fields', 'Email and password are required.');

  const result = await signInAdmin(email, password);
  if (!result.ok) return apiError(401, 'unauthorised', result.error);

  const res = apiOk({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // matches the Supabase access-token lifetime; the token is useless after that anyway
  });
  return res;
}
