// checkout-summary — read path for the checkout page. Scoped narrowly: returns only
// what a payment page needs for a single order; never exposes customer phone to others.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const rl = rateLimit(`checkout-summary:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Slow down. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const orderId = req.nextUrl.searchParams.get('orderId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return apiError(400, 'invalid_order', 'Invalid order reference.');
  }

  try {
    const sb = supabaseService();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, status, total_kobo, store_id, stores(name, slug), order_items(quantity, unit_price_kobo, listings(title))')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return apiError(404, 'order_not_found', 'Order not found.');

    const items = (order.order_items as unknown as Array<{ quantity: number; unit_price_kobo: number; listings: { title: string } | null }> | null) ?? [];

    return apiOk({
      orderId: order.id,
      status: order.status,
      totalKobo: order.total_kobo,
      storeName: (order.stores as unknown as { name: string } | null)?.name ?? 'Store',
      storeSlug: (order.stores as unknown as { slug: string } | null)?.slug ?? '',
      items: items.map((i) => ({ title: i.listings?.title ?? 'Item', quantity: i.quantity, unitPriceKobo: i.unit_price_kobo })),
    });
  } catch (err) {
    return internalError('checkout-summary', err);
  }
}
