// validate-promo — buyer-facing, unauthenticated promo-code check for the
// order form. Read-only: mirrors the exact rules create-order enforces
// (per-store, active, under max uses) but never reveals whether a code
// exists at another store (that would leak seller data). Rate limited.

import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { zoneLabel } from '@/lib/deliveryZones';
import { hasFeature } from '@/lib/plans';
import { FEATURES } from '@/lib/flags';

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
  const zone = sanitizeText(b.zone, 40); // chosen delivery zone, if any

  if (!slug || !code) return apiError(400, 'missing_fields', 'Store and code are required.');

  try {
    const sb = supabaseService();

    const { data: store } = await sb.from('stores').select('id, plan, plan_expires_at').eq('slug', slug).maybeSingle();
    if (!store) return apiError(404, 'store_not_found', 'That store does not exist.');
    // Discount codes are a paid-plan feature: a Free (or lapsed) store's codes don't apply.
    if (!hasFeature(store, 'discounts', FEATURES.planGating)) {
      return apiOk({ valid: false, message: 'That code is not valid for this store.' });
    }

    const { data: promo } = await sb
      .from('discount_codes')
      .select('code, percent_off, active, usage_count, max_uses, zone_id')
      .eq('store_id', store.id)
      .eq('code', code)
      .maybeSingle();

    const p = promo as { code: string; percent_off: number; active: boolean; usage_count: number; max_uses: number | null; zone_id?: string | null } | null;
    if (!p || !p.active || (p.max_uses != null && p.usage_count >= p.max_uses)) {
      // Same message for "doesn't exist" and "exhausted" — don't leak which.
      return apiOk({ valid: false, message: 'That code is not valid for this store.' });
    }

    // Zone-limited codes mirror create-order: only for delivery to that landmark.
    if (p.zone_id && zone !== p.zone_id) {
      return apiOk({
        valid: false,
        zoneId: p.zone_id,
        message: `This code only works for delivery to ${zoneLabel(p.zone_id) || 'its zone'}. Pick that delivery zone first.`,
      });
    }
    return apiOk({ valid: true, percentOff: p.percent_off, zoneId: p.zone_id ?? null });
  } catch (err) {
    return internalError('validate-promo', err);
  }
}
