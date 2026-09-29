// Listing update — authenticated seller, RLS scopes the update to their own
// store (listings_owner_all). Mirrors the create route's validation so edits
// can never put a listing into a state that creation would have rejected.
// Note: `type` is intentionally NOT editable after creation — products have
// orders, services have bookings; changing the type would orphan them.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { revalidateStore } from '@/lib/revalidate';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText, parsePriceKobo } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;

  const listingId = typeof b.listingId === 'string' ? b.listingId : '';
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return apiError(400, 'invalid_listing', 'Invalid listing.');

  const title = sanitizeText(b.title, 160);
  const description = sanitizeText(b.description, 2000);
  const priceKobo = parsePriceKobo(b.priceKobo);

  const rawImages = Array.isArray(b.imageUrls) ? b.imageUrls : [];
  const imageUrls = [...new Set(
    rawImages.filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 500)
  )].slice(0, 5);

  let videoUrl: string | null = null;
  if (typeof b.videoUrl === 'string' && /^https:\/\//.test(b.videoUrl) && b.videoUrl.length <= 500) {
    const okVideo = /\.(mp4|webm|mov)(\?|$)/i.test(b.videoUrl) || b.videoUrl.includes('/store-media/');
    if (okVideo) videoUrl = b.videoUrl;
  }
  if (b.videoUrl === null) videoUrl = null;

  const compareRaw = b.compareAtKobo;
  const compareKobo = compareRaw == null ? null : Math.round(Number(compareRaw));
  const stockRaw = b.stock;
  const stock = stockRaw == null ? null : Math.round(Number(stockRaw));

  if (title.length < 2) return apiError(422, 'invalid_title', 'Give the listing a title.');
  if (priceKobo === null) return apiError(422, 'invalid_price', 'Enter a valid price.');
  if (compareKobo !== null && (!Number.isFinite(compareKobo) || compareKobo < 0)) {
    return apiError(422, 'invalid_compare_at', 'Compare-at price must be a positive number.');
  }
  if (compareKobo !== null && compareKobo <= priceKobo) {
    return apiError(422, 'compare_not_higher', 'Compare-at price must be higher than the price to show a sale.');
  }
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
    return apiError(422, 'invalid_stock', 'Stock must be zero or more.');
  }

  try {
    const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
    if (!store) return apiError(403, 'not_your_store', 'You can only edit listings in your own store.');

    // The listing's type decides whether compare-at/stock apply (products only).
    // RLS + the .eq('store_id') below guarantee this read is own-store only.
    const { data: existing, error: fetchError } = await sb
      .from('listings')
      .select('id, type')
      .eq('id', listingId)
      .eq('store_id', store.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return apiError(404, 'not_found', 'That listing could not be found in your store.');
    const isProduct = (existing as { type: string }).type === 'product';

    const { data: updated, error } = await sb
      .from('listings')
      .update({
        title,
        description,
        price_kobo: priceKobo,
        compare_at_kobo: isProduct ? compareKobo : null,
        stock: isProduct ? stock : null,
        ai_generated_description: b.aiDescription === true,
        image_urls: imageUrls,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)
      .eq('store_id', store.id) // belt-and-suspenders alongside RLS
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!updated) return apiError(404, 'not_found', 'That listing could not be found in your store.');

    revalidateStore(store.slug);
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('listings-update', err);
  }
}
