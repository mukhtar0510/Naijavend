// Custom domain (Emirates Plus, 23 Nov 2026). The seller saves a domain and
// points its DNS at Vercel; the owner adds it to the Vercel project and marks
// it active in /admin → Domains. middleware.ts then serves the store there.
//   POST { domain }      save or change the domain (goes back to pending)
//   POST { action: 'remove' }
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { planLocked, PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';
import { isPlatformHost, normaliseDomain } from '@/lib/domains';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`domain:${clientIp(req)}`, 8, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'Too many tries. Wait a minute.');
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
    if (!store) return apiError(403, 'no_store', 'Only the store owner can do this.');
    const svc = supabaseService();

    if (b.action === 'remove') {
      const { error } = await svc.from('store_domains').delete().eq('store_id', store.id);
      if (error) throw error;
      return apiOk({ removed: true });
    }

    const locked = planLocked(store, 'custom_domain');
    if (locked) return locked;
    const domain = normaliseDomain(b.domain);
    if (!domain) return apiError(422, 'invalid_domain', 'Enter a domain like myshop.com or shop.myshop.com.');
    if (isPlatformHost(domain)) return apiError(422, 'reserved', 'That domain belongs to Kwaravend.');

    const { data: taken } = await svc.from('store_domains').select('store_id').eq('domain', domain).maybeSingle();
    if (taken && taken.store_id !== store.id) return apiError(409, 'taken', 'Another store already uses that domain.');

    const { error } = await svc
      .from('store_domains')
      .upsert({ store_id: store.id, domain, status: 'pending', note: '', activated_at: null, created_at: new Date().toISOString() }, { onConflict: 'store_id' });
    if (error) throw error;
    return apiOk({ domain, status: 'pending' });
  } catch (err) {
    return internalError('domain', err);
  }
}
