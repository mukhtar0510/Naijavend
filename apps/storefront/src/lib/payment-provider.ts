// Payment provider seam (BUILD.md T04, KWARAVEND_IMPROVEMENTS §5.3).
// Today only the MANUAL provider exists: the buyer pays the seller directly
// (cash, transfer, pay on pickup) and the seller confirms it in the dashboard.
// No gateway code, no keys. The owner will add Paystack later: implement this
// interface in `paystack-provider.ts`, then return it from getPaymentProvider()
// when ONLINE_PAYMENTS_ENABLED is true. Checkout and orders don't change.

import { ONLINE_PAYMENTS_ENABLED } from './flags';
import type { PaymentMethod } from './payments';

export interface CreateSessionInput {
  orderId: string;
  /** Server-computed total in kobo (never from the client). */
  amountKobo: number;
  buyerPhone: string;
  buyerEmail?: string | null;
  method: PaymentMethod;
}

export type CreateSessionResult =
  /** Manual: nothing to redirect to; show the seller's instructions. */
  | { kind: 'manual'; instructions: string }
  /** Online (future): send the buyer to the provider's checkout page. */
  | { kind: 'redirect'; url: string; reference: string };

export interface VerifyResult {
  status: 'paid' | 'pending' | 'failed';
  reference: string | null;
}

export interface PaymentProvider {
  readonly id: 'manual' | 'paystack';
  /** Online providers take money in-app; the manual one never does. */
  readonly online: boolean;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  /** Check a payment with the provider (online) — manual payments are confirmed by the seller instead. */
  verify(reference: string): Promise<VerifyResult>;
  refund(reference: string, amountKobo?: number): Promise<{ ok: boolean; message: string }>;
  /** Webhook handler for online providers: verify the signature, then update the order. */
  handleWebhook(req: Request): Promise<Response>;
}

const MANUAL_INSTRUCTIONS: Record<string, string> = {
  cash_on_delivery: 'Pay the rider in cash when your order arrives.',
  pay_on_pickup: 'Pay at the store when you collect your order.',
  bank_transfer: 'Transfer to the seller, then upload the receipt on your order page. The seller confirms it.',
};

/** The only provider today. Never marks anything paid on its own. */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  online: false,
  async createSession(input) {
    return {
      kind: 'manual',
      instructions: MANUAL_INSTRUCTIONS[input.method] ?? 'Arrange payment with the seller. They confirm it when the money arrives.',
    };
  },
  async verify() {
    // Manual payments are confirmed by the seller in the dashboard, never here.
    return { status: 'pending', reference: null };
  },
  async refund() {
    return { ok: false, message: 'Refunds for manual payments are made by the seller directly.' };
  },
  async handleWebhook() {
    return new Response('Manual payments have no webhook.', { status: 404 });
  },
};

export function getPaymentProvider(): PaymentProvider {
  // TODO(owner): when Paystack is added, return the Paystack provider here if
  // ONLINE_PAYMENTS_ENABLED is true. Until then, always manual.
  void ONLINE_PAYMENTS_ENABLED;
  return manualProvider;
}
