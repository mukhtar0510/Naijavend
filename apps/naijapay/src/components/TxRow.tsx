import Link from 'next/link';
import type { Tx } from '@/lib/types';
import { nairaSigned, dateLabel, timeLabel } from '@/lib/format';

const ICON: Record<Tx['kind'], string> = {
  'naijavend-payment': '🛍️',
  topup: '🏦',
  savings: '🐷',
  refund: '↩️',
};

export function TxRow({ tx }: { tx: Tx }) {
  const credit = tx.amountKobo > 0;
  return (
    <Link href={`/transactions/${tx.id}`} className="np-tx">
      <span className={`np-tx-ico${credit ? ' is-credit' : tx.kind === 'savings' ? ' is-save' : ''}`} aria-hidden>
        {ICON[tx.kind]}
      </span>
      <span className="np-tx-main">
        <span className="np-tx-title">{tx.title}</span>
        <span className="np-tx-sub">
          {dateLabel(tx.createdAt)} · {timeLabel(tx.createdAt)}
        </span>
      </span>
      <span className={`np-tx-amt${credit ? ' is-credit' : ''}`}>{nairaSigned(tx.amountKobo)}</span>
    </Link>
  );
}
