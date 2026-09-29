// NaijaPay domain types. Transactions are tagged with their Naijavend role so
// the history can separate marketplace payments from wallet mechanics.

export type TxKind = 'naijavend-payment' | 'topup' | 'savings' | 'refund';

export interface Tx {
  id: string;
  kind: TxKind;
  /** Signed amount in kobo: negative = money left the wallet. */
  amountKobo: number;
  createdAt: string; // ISO
  title: string;
  sub: string;
  /** Naijavend store id when kind = naijavend-payment. */
  storeId?: string;
  /** Free-text note the payer wrote (checkout-style "order note"). */
  note?: string;
  /** Payment reference shown on receipts, Naijavend-checkout style. */
  reference: string;
  /** For refund txs: the id of the store payment this refund came from. */
  refundedFrom?: string;
}

export interface Pocket {
  id: string;
  name: string;
  emoji: string;
  amountKobo: number;
  /** Annual demo rate, e.g. 0.08 = 8%. */
  rate: number;
  createdAt: string;
}

export interface WalletState {
  balanceKobo: number;
  txs: Tx[];
  pockets: Pocket[];
  pin: string;
}
