// Idempotency key for one checkout (INFRASTRUCTURE.md I1). Made once when the
// buyer starts placing an order and reused for every retry of that order, so a
// double tap or a lost response never creates a second order. Cleared after a
// successful order so the next one gets a fresh key.

export function newCheckoutKey(): string | null {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* insecure context */
  }
  return null; // no key: the order still works, just without replay protection
}
