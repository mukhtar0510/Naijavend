// Custom domains (Emirates Plus, 23 Nov 2026). Requests on Kwaravend's own
// hosts pass straight through. On any other host we look up an *active*
// store_domains row (public by RLS) and serve that store: "/" becomes
// /s/<slug>, "/listing/x" becomes /s/<slug>/listing/x. Unknown hosts get the
// normal site. Lookups are cached per edge instance for five minutes.
import { NextResponse, type NextRequest } from 'next/server';
import { isPlatformHost } from '@/lib/domains';
import { hasFeature } from '@/lib/plans';
import { SESSION_COOKIES, cookieOptions, needsRefresh, refreshSessionEdge, type SessionRole } from '@/lib/session-edge';

const TTL = 5 * 60_000;
const cache = new Map<string, { slug: string | null; at: number }>();

async function slugFor(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.slug;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  let slug: string | null = null;
  try {
    const res = await fetch(`${url}/rest/v1/store_domains?select=stores(slug,plan,plan_expires_at)&status=eq.active&domain=eq.${encodeURIComponent(host)}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      type Row = { slug: string; plan?: string | null; plan_expires_at?: string | null };
      const rows = (await res.json()) as Array<{ stores: Row | Row[] | null }>;
      const raw = rows[0]?.stores;
      const st = Array.isArray(raw) ? raw[0] : raw;
      // Own domains are Emirates Plus: a lapsed plan stops serving the domain
      // (gating is checked as on — the plan decides, not the flag).
      slug = st && hasFeature(st, 'custom_domain', true) ? st.slug : null;
    }
  } catch {
    slug = null;
  }
  cache.set(host, { slug, at: Date.now() });
  return slug;
}

/**
 * Refresh an expired seller/buyer session before /dashboard or /account
 * renders (pages can't set cookies). The new cookies go on the response for
 * the browser AND on the forwarded request, so this render already sees them.
 */
async function withFreshSession(req: NextRequest): Promise<NextResponse | null> {
  const p = req.nextUrl.pathname;
  const role: SessionRole | null = p.startsWith('/dashboard') ? 'seller' : p.startsWith('/account') ? 'customer' : null;
  if (!role || p.endsWith('/signin') || p.endsWith('/signout')) return null;
  const names = SESSION_COOKIES[role];
  const access = req.cookies.get(names.access)?.value;
  const refresh = req.cookies.get(names.refresh)?.value;
  if (!refresh || !needsRefresh(access, refresh)) return null;
  const fresh = await refreshSessionEdge(refresh);
  if (!fresh) return null; // leave it to the page (it will send them to sign in)
  const headers = new Headers(req.headers);
  const jar = req.cookies.getAll().filter((c) => c.name !== names.access && c.name !== names.refresh);
  jar.push({ name: names.access, value: fresh.access }, { name: names.refresh, value: fresh.refresh });
  headers.set('cookie', jar.map((c) => `${c.name}=${c.value}`).join('; '));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(names.access, fresh.access, cookieOptions('access'));
  res.cookies.set(names.refresh, fresh.refresh, cookieOptions('refresh'));
  return res;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().replace(/:\d+$/, '');
  if (!host || isPlatformHost(host)) return (await withFreshSession(req)) ?? NextResponse.next();
  const slug = await slugFor(host);
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/s/')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = pathname === '/' ? `/s/${slug}` : `/s/${slug}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: never assets, API routes or Next internals.
  matcher: ['/((?!_next/|api/|favicon|icons/|images/|fonts/|manifest|robots|sitemap|.*\\.[a-z0-9]{2,5}$).*)'],
};
