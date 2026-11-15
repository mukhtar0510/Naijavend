import { NextRequest, NextResponse } from 'next/server';

// Landing redirect for `/` only.
//
// `/` is still the brand's About/Naijavend story — that has NOT moved. But it
// should be seen once, not every time someone taps the logo. So:
//   • first visit  → serve About (inside the page) and drop a 1-year marker cookie
//   • any later visit → send them straight to the marketplace at /home
// Signed-in sellers are left alone: the page itself still redirects them to
// /dashboard, which is a better destination than /home.
//
// `/about` keeps rendering the same About page for anyone who wants it again,
// and the footer/"take the tour" links point there.

export const LANDING_SEEN_COOKIE = 'nv_landing_seen';

export function middleware(req: NextRequest) {
  // Sellers/staff have a live session — let the page decide (→ /dashboard).
  const signedIn = req.cookies.has('idev_access_token') || req.cookies.has('idev_refresh_token');

  if (!signedIn && req.cookies.get(LANDING_SEEN_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/home';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (!req.cookies.get(LANDING_SEEN_COOKIE)?.value) {
    res.cookies.set(LANDING_SEEN_COOKIE, '1', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
  }
  return res;
}

export const config = {
  // Exact match on the site root only — every other route is untouched.
  matcher: '/',
};
