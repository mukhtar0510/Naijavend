// checkout-summary — read path for the checkout page. Scoped narrowly: returns only
// what a payment page needs for a single order; never exposes customer phone to others.
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { verifyPayToken } from '@/lib/paytoken';
import { getCustomerUser } from '@/lib/auth';

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
      // `*` (not an explicit column list) so this keeps working before the T04
      // payment columns migration is applied.
      .select('*, stores(name, slug), order_items(quantity, unit_price_kobo, listings(title, type))')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return apiError(404, 'order_not_found', 'Order not found.');

    const items = (order.order_items as unknown as Array<{ quantity: number; unit_price_kobo: number; listings: { title: string; type: string } | null }> | null) ?? [];

    // Paid digital orders? Then a fresh delivery row (one-time token) exists for
    // each digital item. We surface minted, UNUSED tokens so the buyer can
    // download straight from the receipt. Regenerating is impossible from the
    // client — the token only exists server-side.
    // Private parts (download links, bank details, receipt) only go to the
    // holder of this order's pay link (?pt=) or the signed-in buyer — never to
    // anyone who merely has the order id (it appears in shared URLs).
    const pt = req.nextUrl.searchParams.get('pt') ?? '';
    const hasPayToken = Boolean(pt) && verifyPayToken(order.id, pt);
    const customer = hasPayToken || !order.customer_id ? null : await getCustomerUser();
    const isBuyer = hasPayToken || Boolean(customer && customer.id === order.customer_id);

    let digitalDownloads: Array<{ title: string; fileName: string; downloadUrl: string }> = [];
    if (order.status === 'paid' && isBuyer) {
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

    // Tracking link for delivered orders (T09). Best-effort before the migration.
    const { data: delivery } = await sb.from('deliveries').select('tracking_token, status').eq('order_id', order.id).maybeSingle();

    // Where to transfer: only for bank-transfer orders, and only to the holder
    // of this order's private pay link (?pt=), never to anyone with the id.
    let bank: { bankName: string; accountName: string; accountNumber: string } | null = null;
    if (order.payment_method === 'bank_transfer' && hasPayToken) {
      const { data: acct } = await sb
        .from('store_bank_accounts')
        .select('bank_name, account_name, account_number')
        .eq('store_id', order.store_id)
        .maybeSingle();
      if (acct) bank = { bankName: acct.bank_name, accountName: acct.account_name, accountNumber: acct.account_number };
    }

    return apiOk({
      orderId: order.id,
      orderCode: (order as { order_code?: string | null }).order_code ?? null,
      trackingToken: (delivery as { tracking_token?: string } | null)?.tracking_token ?? null,
      deliveryStatus: (delivery as { status?: string } | null)?.status ?? null,
      bank,
      status: order.status,
      totalKobo: order.total_kobo,
      deliveryMethod: order.delivery_method ?? '',
      deliveryZone: (order as { delivery_zone?: string }).delivery_zone ?? '',
      deliveryFeeKobo: order.delivery_fee_kobo ?? 0,
      paymentStatus: order.payment_status ?? undefined,
      paymentMethod: order.payment_method ?? '',
      paymentProofUrl: isBuyer ? order.payment_proof_url ?? null : null,
      storeName: (order.stores as unknown as { name: string } | null)?.name ?? 'Store',
      storeSlug: (order.stores as unknown as { slug: string } | null)?.slug ?? '',
      items: items.map((i) => ({ title: i.listings?.title ?? 'Item', quantity: i.quantity, unitPriceKobo: i.unit_price_kobo })),
      digitalDownloads,
    });
  } catch (err) {
    return internalError('checkout-summary', err);
  }
}
