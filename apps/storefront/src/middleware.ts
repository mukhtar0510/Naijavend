// Custom domains (Emirates Plus, 23 Nov 2026). Requests on Kwaravend's own
// hosts pass straight through. On any other host we look up an *active*
// store_domains row (public by RLS) and serve that store: "/" becomes
// /s/<slug>, "/listing/x" becomes /s/<slug>/listing/x. Unknown hosts get the
// normal site. Lookups are cached per edge instance for five minutes.
import { NextResponse, type NextRequest } from 'next/server';
import { isPlatformHost } from '@/lib/domains';

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
    const res = await fetch(`${url}/rest/v1/store_domains?select=stores(slug)&status=eq.active&domain=eq.${encodeURIComponent(host)}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ stores: { slug: string } | Array<{ slug: string }> | null }>;
      const s = rows[0]?.stores;
      slug = (Array.isArray(s) ? s[0]?.slug : s?.slug) ?? null;
    }
  } catch {
    slug = null;
  }
  cache.set(host, { slug, at: Date.now() });
  return slug;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().replace(/:\d+$/, '');
  if (!host || isPlatformHost(host)) return NextResponse.next();
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
