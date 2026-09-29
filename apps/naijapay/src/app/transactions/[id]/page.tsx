'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useWallet } from '@/lib/wallet';
import { naira, dateLabel, timeLabel } from '@/lib/format';
import { storeById } from '@/lib/stores';

const KIND_LABEL: Record<string, string> = {
  'naijavend-payment': 'Naijavend payment',
  topup: 'Wallet top-up',
  savings: 'Savings transfer',
  refund: 'Refund / withdrawal',
};

export default function TxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, refundTx } = useWallet();
  const tx = state.txs.find((t) => t.id === id);
  const store = tx?.storeId ? storeById(tx.storeId) : undefined;

  if (!tx) {
    return (
      <div className="empty-state">
        Transaction not found. <Link href="/transactions">Back to history</Link>
      </div>
    );
  }

  const credit = tx.amountKobo > 0;
  // Already refunded? Derived from history, so it survives revisits and resets.
  const canRefund = tx.kind === 'naijavend-payment' && !state.txs.some((t) => t.kind === 'refund' && t.refundedFrom === tx.id);

  return (
    <>
      <div className="np-success-hero" style={{ paddingTop: 12 }}>
        <div className={`np-success-ico${credit ? '' : ' np-out'}`} aria-hidden style={!credit ? { background: 'var(--blue-tint)', color: 'var(--blue)' } : undefined}>
          {credit ? '↓' : '↑'}
        </div>
        <h2 style={{ marginBottom: 2 }}>{naira(Math.abs(tx.amountKobo))}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {credit ? 'Money in' : 'Money out'} · {KIND_LABEL[tx.kind] ?? tx.kind}
        </p>
      </div>

      <div className="card">
        <div className="np-kv">
          <span className="np-kv-k">{tx.kind === 'naijavend-payment' ? 'Store' : 'Title'}</span>
          <span className="np-kv-v">{store ? `${store.emoji} ${store.name}` : tx.title}</span>
        </div>
        {store && (
          <div className="np-kv">
            <span className="np-kv-k">Category</span>
            <span className="np-kv-v">{store.category}</span>
          </div>
        )}
        {tx.note && (
          <div className="np-kv">
            <span className="np-kv-k">Order note</span>
            <span className="np-kv-v">{tx.note}</span>
          </div>
        )}
        <div className="np-kv">
          <span className="np-kv-k">Date</span>
          <span className="np-kv-v">
            {dateLabel(tx.createdAt)} · {timeLabel(tx.createdAt)}
          </span>
        </div>
        <div className="np-kv">
          <span className="np-kv-k">Reference</span>
          <span className="np-kv-v mono">{tx.reference}</span>
        </div>
        <div className="np-kv">
          <span className="np-kv-k">Status</span>
          <span className="np-kv-v">
            <span className="badge badge-success">Successful · demo</span>
          </span>
        </div>
      </div>

      {canRefund && (
        <button
          type="button"
          className="btn btn-outline btn-block"
          style={{ marginTop: 14 }}
          onClick={() => refundTx(tx.id)}
        >
          ↩️ Simulate store refund ({naira(Math.abs(tx.amountKobo))})
        </button>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <Link className="btn btn-outline" href="/transactions">
          ← History
        </Link>
        {store && (
          <Link className="btn btn-ghost" href="/pay">
            Pay this store again
          </Link>
        )}
      </div>
    </>
  );
}
