import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth';

// POST only — a GET sign-out is CSRF-prone: any page an attacker tricks the
// seller into opening (an <img src>, a cross-site form preflight) could log
// them out. Browsers won't POST cross-site without a deliberate form.
export async function POST() {
  await clearSessionCookies();
  return NextResponse.redirect(new URL('/dashboard/signin', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'), { status: 303 });
}
