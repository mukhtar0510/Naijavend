// Email + password sign-in for the standalone admin. Verifies credentials via
// Supabase Auth, checks the ADMIN_EMAILS allow-list, then sets an httpOnly
// session cookie holding the Supabase access token.
import { NextRequest, NextResponse } from 'next/server';
import { signInAdmin, SESSION_COOKIE } from '@/lib/admin';
import { apiOk, apiError } from '@/lib/api';

export async function POST(req: NextRequest) {
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
    maxAge: 60 * 60 * 24 * 7, // Supabase access tokens last 1h; re-login weekly is fine for an admin console
  });
  return res;
}
