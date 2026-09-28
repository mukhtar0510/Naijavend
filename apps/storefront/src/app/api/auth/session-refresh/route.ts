// Session refresh bounce: Server Components cannot set cookies (Next 14 throws
// "Cookies can only be modified in a Server Action or Route Handler"), so when
// lib/auth detects an expired/missing access cookie during a page render it
// redirects here. As a route handler we CAN legally refresh the session and
// persist the rotated cookies, then send the user back to where they were
// headed — one extra hop, invisible to the user.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  supabaseAuthClient,
  setSessionCookies,
  setCustomerSessionCookies,
  REFRESH_TOKEN_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
} from '@/lib/auth';

const SAFE_DEST = /^\/(dashboard|account)(\/|$)/;

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role') === 'seller' ? 'seller' : 'customer';
  const rawDest = req.nextUrl.searchParams.get('next') ?? '';
  // Open-redirect guard: only same-site dashboard/account paths survive.
  const dest = SAFE_DEST.test(rawDest) && !rawDest.includes('\\') ? rawDest : role === 'seller' ? '/dashboard' : '/account';

  const jar = await cookies();
  const refreshCookie = role === 'seller' ? REFRESH_TOKEN_COOKIE : CUSTOMER_REFRESH_COOKIE;
  const refresh = jar.get(refreshCookie)?.value;
  if (!refresh) {
    return NextResponse.redirect(new URL(role === 'seller' ? '/dashboard/signin' : '/account/signin', req.nextUrl.origin));
  }

  const sb = supabaseAuthClient();
  const { data, error } = await sb.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) {
    // Refresh token dead/revoked → clean slate at the right sign-in page.
    return NextResponse.redirect(new URL(role === 'seller' ? '/dashboard/signin' : '/account/signin', req.nextUrl.origin));
  }

  if (role === 'seller') {
    await setSessionCookies(data.session.access_token, data.session.refresh_token);
  } else {
    await setCustomerSessionCookies(data.session.access_token, data.session.refresh_token);
  }

  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
