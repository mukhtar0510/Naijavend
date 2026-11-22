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
    // The token guards the buyer's bank details, receipt upload and digital
    // downloads, so the key must be a real secret. It used to be derived from
    // ADMIN_EMAILS — an email address is guessable, which let anyone forge a
    // token for any order id. Prefer PAY_TOKEN_SECRET; otherwise derive from
    // the service-role key, which never leaves the server.
    const base = process.env.PAY_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base) throw new Error('Set PAY_TOKEN_SECRET (or SUPABASE_SERVICE_ROLE_KEY) to mint payment tokens.');
    cachedSecret = createHash('sha256').update(`${base}::kwaravend-pay-token-v2`).digest('hex');
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
