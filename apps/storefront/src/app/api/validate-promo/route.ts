// validate-promo — buyer-facing, unauthenticated promo-code check for the
// order form. Read-only: mirrors the exact rules create-order enforces
// (per-store, active, under max uses) but never reveals whether a code
// exists at another store (that would leak seller data). Rate limited.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`validate-promo:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many checks. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const slug = sanitizeText(b.slug, 80);
  const code = sanitizeText(b.code, 40).toUpperCase();

  if (!slug || !code) return apiError(400, 'missing_fields', 'Store and code are required.');

  try {
    const sb = supabaseService();

    const { data: store } = await sb.from('stores').select('id').eq('slug', slug).maybeSingle();
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');

    const { data: promo } = await sb
      .from('discount_codes')
      .select('code, percent_off, active, usage_count, max_uses')
      .eq('store_id', store.id)
      .eq('code', code)
      .maybeSingle();

    const p = promo as { code: string; percent_off: number; active: boolean; usage_count: number; max_uses: number | null } | null;
    if (!p || !p.active || (p.max_uses != null && p.usage_count >= p.max_uses)) {
      // Same message for "doesn't exist" and "exhausted" — don't leak which.
      return apiOk({ valid: false, message: 'That code is not valid for this store.' });
    }

    return apiOk({ valid: true, percentOff: p.percent_off });
  } catch (err) {
    return internalError('validate-promo', err);
  }
}
