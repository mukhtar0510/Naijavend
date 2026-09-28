import { NextRequest, NextResponse } from 'next/server';
import { clearCustomerSessionCookies } from '@/lib/auth';

// POST only — same CSRF rule as the seller sign-out: a GET here could be
// triggered by any cross-site <img> or link and log the customer out.
export async function POST(req: NextRequest) {
  await clearCustomerSessionCookies();
  return NextResponse.redirect(new URL('/account/signin', req.url), { status: 303 });
}
