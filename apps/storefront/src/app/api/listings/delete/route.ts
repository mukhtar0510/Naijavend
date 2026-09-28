// Listing delete — POST only. (GET was CSRF-prone: a cross-site <img> or form
// on any page a logged-in seller visits could trigger deletion. Browsers won't
// POST cross-site without a form, and Supabase-auth cookie requests here are
// same-origin only.)
//
// Blocked if the listing appears in any order (order_items FK is RESTRICT),
// which keeps financial history intact (auditable per guardrails doc §8).
import { NextRequest, NextResponse } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { internalError } from '@/lib/api';

async function readListingId(req: NextRequest): Promise<string> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      return typeof body.listingId === 'string' ? body.listingId : '';
    } catch {
      return '';
    }
  }
  // HTML form fallback (the dashboard uses a plain <form method="post">).
  try {
    const form = await req.formData();
    const v = form.get('listingId');
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) {
    return NextResponse.redirect(new URL('/dashboard/signin', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  }

  const listingId = await readListingId(req);
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
    return NextResponse.redirect(new URL('/dashboard/listings?error=invalid', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  }

  try {
    const { error } = await sb.from('listings').delete().eq('id', listingId);
    const flag = error
      ? String(error.message).includes('foreign key') ? 'has-orders' : 'error'
      : 'deleted';
    return NextResponse.redirect(new URL(`/dashboard/listings?remove=${flag}`, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  } catch (err) {
    return internalError('listings-delete', err);
  }
}
