'use client';

import Link from 'next/link';
import { useWallet } from '@/lib/wallet';
import { naira } from '@/lib/format';
import { TxRow } from '@/components/TxRow';

export default function HomePage() {
  const { state } = useWallet();
  const recent = state.txs.slice(0, 5);
  const now = new Date();
  const spentThisMonth = state.txs
    .filter(
      (t) =>
        t.kind === 'naijavend-payment' &&
        new Date(t.createdAt).getFullYear() === now.getFullYear() &&
        new Date(t.createdAt).getMonth() === now.getMonth()
    )
    .reduce((s, t) => s + Math.abs(t.amountKobo), 0);

  return (
    <>
      <section className="np-balance" aria-label="Wallet balance">
        <span className="np-balance-badge">DEMO</span>
        <p className="np-balance-label">Available balance</p>
        <p className="np-balance-amount">{naira(state.balanceKobo)}</p>
        <p className="np-balance-sub">Spent on Naijavend this month: {naira(spentThisMonth)}</p>
      </section>

      <section className="np-actions" aria-label="Quick actions">
        <Link href="/add-money" className="np-action">
          <span className="np-action-ico" aria-hidden>＋</span>
          Add money
        </Link>
        <Link href="/pay" className="np-action">
          <span className="np-action-ico" aria-hidden>🛍️</span>
          Pay store
        </Link>
        <Link href="/savings" className="np-action">
          <span className="np-action-ico" aria-hidden>🐷</span>
          Savings
        </Link>
      </section>

      <div className="np-sect">
        <h2>Recent activity</h2>
        <Link href="/transactions" className="np-sect-link">
          See all
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="empty-state">No transactions yet — top up to get started.</div>
      ) : (
        recent.map((tx) => <TxRow key={tx.id} tx={tx} />)
      )}

      <p className="np-demo-note">
        🧪 NaijaPay is a demo wallet for paying Naijavend stores. Balances live only in this browser; no real money moves.
      </p>
    </>
  );
}
