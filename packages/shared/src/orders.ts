// Order creation helpers shared by the checkout and POS routes (INFRASTRUCTURE.md I1).
// The database (create_order_v2 / create_pos_order) prices every order; these
// helpers only check request shape and turn database error codes into buyer copy.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export const ORDER_MAX_LINES = 30;
export const ORDER_MAX_QUANTITY = 50;

export interface OrderError {
  status: number;
  code: string;
  message: string;
  /** Listing id named by INSUFFICIENT_STOCK, so the route can name the item. */
  listingId?: string;
  /** Zone id for PROMO_ZONE, minimum in kobo for PROMO_MIN_ORDER. */
  detail?: string;
}

const MESSAGES: Record<string, [number, string]> = {
  EMPTY_CART: [400, 'Your cart is empty.'],
  INVALID_ITEMS: [400, 'Your cart has items we could not read. Refresh the page and try again.'],
  TOO_MANY_LINES: [422, `An order can have at most ${ORDER_MAX_LINES} different items.`],
  BAD_QUANTITY: [422, `Each item can be ordered 1 to ${ORDER_MAX_QUANTITY} times.`],
  STORE_NOT_FOUND: [404, 'That store does not exist.'],
  EXAMPLE_STORE: [403, 'This is an example store with sample data. It cannot take orders.'],
  UNKNOWN_LISTING: [422, 'One or more items are no longer available.'],
  NOT_ORDERABLE: [422, 'Services are booked, not ordered. Use the booking flow.'],
  INSUFFICIENT_STOCK: [422, 'One of your items does not have enough stock left.'],
  INVALID_DELIVERY: [422, 'That delivery option is not available for this store.'],
  INVALID_ZONE: [422, 'This store does not deliver to that zone.'],
  INVALID_PIN: [422, 'The map pin must be inside Ilorin.'],
  INVALID_PROMO: [422, 'That discount code is not valid for this store.'],
  PROMO_ZONE: [422, 'That code only works for delivery to its zone.'],
  PROMO_MIN_ORDER: [422, 'Your order is below the minimum for that code.'],
  INVALID_NAME: [400, 'Enter your full name (at least 2 characters).'],
  INVALID_PHONE: [422, 'Enter a valid phone number in international format, e.g. +2348012345678.'],
  INVALID_PAYMENT_METHOD: [422, 'Pick how you will pay.'],
  RATE_LIMITED: [429, 'Too many orders in a short time. Wait a few minutes and try again.'],
  IDEMPOTENCY_KEY_REUSED: [409, 'This checkout was already used for another order. Refresh the page and try again.'],
  NOT_AUTHORISED: [403, 'Only the store owner or active staff can do this.'],
};

/**
 * Map a Postgres error message from the order functions to an API error.
 * Returns null for anything unexpected, so the caller logs it as a 500.
 */
export function mapOrderError(message: string | null | undefined): OrderError | null {
  if (!message) return null;
  const m = /^([A-Z_]+)(?::\s*(.*))?$/.exec(message.trim());
  if (!m) return null;
  const code = m[1]!;
  const hit = MESSAGES[code];
  if (!hit) return null;
  const rest = m[2] ?? '';
  const out: OrderError = { status: hit[0], code: code.toLowerCase(), message: hit[1] };
  if (code === 'INSUFFICIENT_STOCK') {
    const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(rest);
    if (id) out.listingId = id[1];
  } else if (rest) {
    out.detail = rest;
  }
  return out;
}

/** Cart lines in the shape create_order_v2 expects. */
export function toOrderItems(lines: Array<{ listingId: string; quantity: number }>): Array<{ listing_id: string; quantity: number }> {
  return lines.map((l) => ({ listing_id: l.listingId, quantity: l.quantity }));
}
