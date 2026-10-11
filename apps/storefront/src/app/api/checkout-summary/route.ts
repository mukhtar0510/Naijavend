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
      .select('id, status, total_kobo, store_id, stores(name, slug), order_items(quantity, unit_price_kobo, listings(title, type))')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return apiError(404, 'order_not_found', 'Order not found.');

    const items = (order.order_items as unknown as Array<{ quantity: number; unit_price_kobo: number; listings: { title: string; type: string } | null }> | null) ?? [];

    // Paid digital orders? Then a fresh delivery row (one-time token) exists for
    // each digital item. We surface minted, UNUSED tokens so the buyer can
    // download straight from the receipt. Regenerating is impossible from the
    // client — the token only exists server-side.
    let digitalDownloads: Array<{ title: string; fileName: string; downloadUrl: string }> = [];
    if (order.status === 'paid') {
      const { data: deliveries, error: ddErr } = await sb
        .from('digital_deliveries')
        .select('download_token, token_used_at, listings(title, type, digital_file_name)')
        .eq('order_id', order.id)
        .is('token_used_at', null); // only offer still-valid, never-used links
      if (!ddErr && deliveries) {
        digitalDownloads = (deliveries as unknown as Array<{
          download_token: string;
          token_used_at: string | null;
          listings: { title: string; type: string; digital_file_name: string | null } | null;
        }>)
          .filter((d) => d.listings?.type === 'digital' && d.listings.digital_file_name)
          .map((d) => ({
            title: d.listings!.title,
            fileName: d.listings!.digital_file_name as string,
            downloadUrl: `/api/digital/download/${d.download_token}`,
          }));
      }
    }

    return apiOk({
      orderId: order.id,
      status: order.status,
      totalKobo: order.total_kobo,
      storeName: (order.stores as unknown as { name: string } | null)?.name ?? 'Store',
      storeSlug: (order.stores as unknown as { slug: string } | null)?.slug ?? '',
      items: items.map((i) => ({ title: i.listings?.title ?? 'Item', quantity: i.quantity, unitPriceKobo: i.unit_price_kobo })),
      digitalDownloads,
    });
  } catch (err) {
    return internalError('checkout-summary', err);
  }
}
