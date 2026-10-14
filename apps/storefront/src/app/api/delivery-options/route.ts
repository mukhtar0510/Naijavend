// delivery-options — public read of a store's enabled delivery methods so the
// order page can show fees BEFORE checkout (blueprint: pickup / same-city
// rider / nationwide courier). Fees are re-validated server-side in create-order.
import { NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';

// Not exported: Next.js route files may only export HTTP handlers + route
// config, so `next build`'s type validation rejects extra exports.
const METHODS = ['pickup', 'rider', 'courier'] as const;
type DeliveryMethod = (typeof METHODS)[number];

const METHOD_LABELS: Record<DeliveryMethod, string> = {
  pickup: 'Pickup',
  rider: 'Same-city rider',
  courier: 'Nationwide courier',
};

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get('slug') ?? '').trim().slice(0, 80);
  if (!slug) return apiError(400, 'missing_store', 'Store is required.');

  try {
    const sb = supabaseAnon();
    const { data: store, error } = await sb
      .from('stores')
      .select('delivery_options')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!store) return apiError(404, 'store_not_found', 'Store not found.');

    const raw = store.delivery_options as Record<string, { enabled?: boolean; fee_kobo?: number }> | null;
    if (!raw || typeof raw !== 'object') return apiOk({ options: [] });

    const options = METHODS.filter((m) => raw[m]?.enabled).map((m) => ({
      method: m,
      label: METHOD_LABELS[m],
      feeKobo: Math.max(0, Number(raw[m]?.fee_kobo ?? 0)),
    }));
    return apiOk({ options });
  } catch (err) {
    return internalError('delivery-options', err);
  }
}
