'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { naira } from '@/lib/format';
import type { TxKind } from '@/lib/types';
import { TxRow } from '@/components/TxRow';

const FILTERS: Array<{ id: TxKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'naijavend-payment', label: '🛍️ Store payments' },
  { id: 'topup', label: '🏦 Top-ups' },
  { id: 'savings', label: '🐷 Savings' },
  { id: 'refund', label: '↩️ Refunds' },
];

export default function TransactionsPage() {
  const { state } = useWallet();
  const [filter, setFilter] = useState<TxKind | 'all'>('all');

  const txs = filter === 'all' ? state.txs : state.txs.filter((t) => t.kind === filter);

  const inKobo = txs.filter((t) => t.amountKobo > 0).reduce((s, t) => s + t.amountKobo, 0);
  const outKobo = txs.filter((t) => t.amountKobo < 0).reduce((s, t) => s - t.amountKobo, 0);

  return (
    <>
      <h2>Transactions</h2>

      <div className="np-summary">
        <div className="np-stat">
          <div className="np-stat-k">Money in</div>
          <div className="np-stat-v" style={{ color: 'var(--success)' }}>{naira(inKobo)}</div>
        </div>
        <div className="np-stat">
          <div className="np-stat-k">Money out</div>
          <div className="np-stat-v" style={{ color: 'var(--danger)' }}>{naira(outKobo)}</div>
        </div>
      </div>

      <div className="np-filters" role="tablist" aria-label="Filter transactions">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`np-chip${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {txs.length === 0 ? (
        <div className="empty-state">Nothing here yet for this filter.</div>
      ) : (
        txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
      )}
    </>
  );
}
