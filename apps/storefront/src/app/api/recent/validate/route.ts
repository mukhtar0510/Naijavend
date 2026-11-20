import { NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Browser-side "recently viewed" history lives in localStorage, so it can name
// stores and listings that have since been deleted. The homepage and My account
// ask this route which entries still exist and drop the rest.

const MAX_PER_KIND = 24;

function clean(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= 120)
    )
  ).slice(0, MAX_PER_KIND);
}

export async function GET(req: Request) {
  const rl = rateLimit(`recent-validate:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const url = new URL(req.url);
  const slugs = clean(url.searchParams.get('stores'));
  const rawListingIds = clean(url.searchParams.get('listings'));
  // listings.id is a uuid; malformed/legacy ids can't match anything and would
  // also make PostgREST error out, so drop them before querying.
  const listingIds = rawListingIds.filter((v) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );

  if (slugs.length === 0 && listingIds.length === 0) {
    return NextResponse.json({ stores: [], listings: [] });
  }

  const sb = supabaseAnon();
  const [storeRes, listingRes] = await Promise.all([
    slugs.length
      ? sb.from('stores').select('slug').in('slug', slugs)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? sb.from('listings').select('id').in('id', listingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (storeRes.error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  if (listingRes.error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });

  return NextResponse.json({
    stores: (storeRes.data ?? []).map((r) => r.slug as string),
    listings: (listingRes.data ?? []).map((r) => r.id as string),
  });
}
