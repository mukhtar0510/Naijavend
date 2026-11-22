import { describe, expect, it } from 'vitest';
import { isUuid, mapOrderError, toOrderItems } from './orders';

describe('isUuid', () => {
  it('accepts a v4 uuid and rejects the old cart-derived key', () => {
    expect(isUuid('0f8b6c1e-3c1a-4c55-9d1e-8a2b3c4d5e6f')).toBe(true);
    expect(isUuid('my-store:abcx1,defx2:29400000')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('mapOrderError', () => {
  it('maps stock errors and keeps the listing id', () => {
    const e = mapOrderError('INSUFFICIENT_STOCK: only 0 left of listing f0ea5894-b9c8-4e54-9650-7234ca6c059c');
    expect(e).toMatchObject({ status: 422, code: 'insufficient_stock', listingId: 'f0ea5894-b9c8-4e54-9650-7234ca6c059c' });
  });

  it('maps codes with details', () => {
    expect(mapOrderError('PROMO_MIN_ORDER:300000')).toMatchObject({ code: 'promo_min_order', detail: '300000' });
    expect(mapOrderError('PROMO_ZONE:unilorin')).toMatchObject({ code: 'promo_zone', detail: 'unilorin' });
  });

  it('maps rate limits to 429 and key reuse to 409', () => {
    expect(mapOrderError('RATE_LIMITED')?.status).toBe(429);
    expect(mapOrderError('IDEMPOTENCY_KEY_REUSED')?.status).toBe(409);
  });

  it('returns null for unknown or internal errors', () => {
    expect(mapOrderError('duplicate key value violates unique constraint')).toBeNull();
    expect(mapOrderError('SOMETHING_ELSE')).toBeNull();
    expect(mapOrderError('')).toBeNull();
  });
});

describe('toOrderItems', () => {
  it('sends only ids and quantities, never prices', () => {
    const items = toOrderItems([{ listingId: 'a', quantity: 2, priceKobo: 1 } as never]);
    expect(items).toEqual([{ listing_id: 'a', quantity: 2 }]);
  });
});
