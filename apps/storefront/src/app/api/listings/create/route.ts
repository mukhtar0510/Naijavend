// Listing creation — authenticated seller, RLS scopes insert to their own store.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { revalidateStore } from '@/lib/revalidate';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText, parsePriceKobo, isListingType } from '@idevtenancy/shared';

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
  const storeId = sanitizeText(b.storeId, 40);
  const type = b.type;
  const title = sanitizeText(b.title, 160);
  const description = sanitizeText(b.description, 2000);
  const priceKobo = parsePriceKobo(b.priceKobo);

  // Listing photos: 0–5 https URLs (uploaded to the store-media bucket first).
  const rawImages = Array.isArray(b.imageUrls) ? b.imageUrls : [];
  const imageUrls = [...new Set(
    rawImages.filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 500)
  )].slice(0, 5);

  // Optional product video: exactly one https URL (must be video-like or store-media).
  let videoUrl: string | null = null;
  if (typeof b.videoUrl === 'string' && /^https:\/\//.test(b.videoUrl) && b.videoUrl.length <= 500) {
    const okVideo = /\.(mp4|webm|mov)(\?|$)/i.test(b.videoUrl) || b.videoUrl.includes('/store-media/');
    if (okVideo) videoUrl = b.videoUrl;
  }

  // Optional sale price + stock (products only). Validated here, stored in kobo.
  const compareRaw = b.compareAtKobo;
  const compareKobo = compareRaw == null ? null : Math.round(Number(compareRaw));
  const stockRaw = b.stock;
  const stock = stockRaw == null ? null : Math.round(Number(stockRaw));

  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return apiError(400, 'invalid_store', 'Invalid store.');
  if (!isListingType(type)) return apiError(422, 'invalid_type', 'Type must be product or service.');
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
    // Ownership check (RLS also enforces this — belt and suspenders).
    const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
    if (!store || store.id !== storeId) return apiError(403, 'not_your_store', 'You can only add listings to your own store.');

    const { error } = await sb.from('listings').insert({
      store_id: storeId,
      type,
      title,
      description,
      price_kobo: priceKobo,
      compare_at_kobo: type === 'product' ? compareKobo : null,
      stock: type === 'product' ? stock : null,
      is_bookable: type === 'service',
      ai_generated_description: b.aiDescription === true,
      image_urls: imageUrls,
      video_url: videoUrl,
    });
    if (error) throw error;

    // New listing — refresh the store page, catalogue and marketplace caches now.
    revalidateStore(store.slug);

    return apiOk({ created: true }, 201);
  } catch (err) {
    return internalError('listings-create', err);
  }
}
