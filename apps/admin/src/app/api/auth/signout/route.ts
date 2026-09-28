// Sign out — clears the admin session cookie.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin';
import { apiOk } from '@/lib/api';

export async function POST() {
  const res = apiOk({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
