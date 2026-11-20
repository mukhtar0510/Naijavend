// Payment status and method labels for a no-gateway marketplace. Sellers take
// cash, bank transfer or payment on pickup, then confirm the money themselves.

export type PaymentStatus = 'unpaid' | 'awaiting_confirmation' | 'paid' | 'refunded' | 'failed';
export type PaymentMethod = '' | 'cash_on_delivery' | 'bank_transfer' | 'pay_on_pickup' | 'other';

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  awaiting_confirmation: 'Awaiting confirmation',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  unpaid: 'badge',
  awaiting_confirmation: 'badge-black',
  paid: 'badge-naija',
  refunded: 'badge-danger',
  failed: 'badge-danger',
};

/** Methods a buyer can choose at checkout (the seller-facing "other" is not offered). */
export const PAYMENT_METHODS: Array<{
  id: Exclude<PaymentMethod, '' | 'other'>;
  label: string;
  hint: string;
}> = [
  { id: 'cash_on_delivery', label: 'Cash on delivery', hint: 'Pay the rider when it arrives' },
  { id: 'bank_transfer', label: 'Bank transfer', hint: 'Transfer first, then send the receipt' },
  { id: 'pay_on_pickup', label: 'Pay on pickup', hint: 'Pay when you collect it' },
];

/** Every value the API accepts, including legacy/blank rows. */
export const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  '',
  'cash_on_delivery',
  'bank_transfer',
  'pay_on_pickup',
  'other',
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  '': 'Not set',
  cash_on_delivery: 'Cash on delivery',
  bank_transfer: 'Bank transfer',
  pay_on_pickup: 'Pay on pickup',
  other: 'Other',
};

/** Normalise a missing column (pre-migration rows) to the closest sensible value. */
export function paymentStatusOf(order: { payment_status?: string | null; status?: string | null }): PaymentStatus {
  const s = order.payment_status;
  if (s && s in PAYMENT_STATUS_LABEL) return s as PaymentStatus;
  if (order.status === 'paid' || order.status === 'fulfilled') return 'paid';
  if (order.status === 'refunded') return 'refunded';
  return 'unpaid';
}
