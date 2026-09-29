// Payment-intent tokens for the mock payment flow. mock-pay used to accept
// any anonymous POST with an orderId — anyone could mark any pending order
// paid (griefing) and self-marked "paid" orders defeated the ratings
// anti-fraud. Now create-order mints an HMAC over the orderId and mock-pay
// requires it, so only someone who just created the order can pay it.
// (When the real Paystack webhook lands, signature verification replaces this.)
import { createHmac, createHash, timingSafeEqual } from 'crypto';

let cachedSecret: string | null = null;

function secret(): string {
  if (!cachedSecret) {
    // Not a password-strength secret — it gates a demo payment flow. It exists
    // so tokens can't be forged without reading the server env, and rotates
    // whenever ADMIN_EMAILS changes (invalidating outstanding checkout links).
    cachedSecret = createHash('sha256')
      .update(`${process.env.ADMIN_EMAILS ?? 'idevtenancy'}::naijavend-mock-pay-v1`)
      .digest('hex');
  }
  return cachedSecret;
}

export function mintPayToken(orderId: string): string {
  return createHmac('sha256', secret()).update(orderId).digest('hex');
}

export function verifyPayToken(orderId: string, token: string): boolean {
  if (typeof token !== 'string' || token.length !== 64) return false;
  const expected = mintPayToken(orderId);
  try {
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
