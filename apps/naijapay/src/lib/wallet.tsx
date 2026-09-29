'use client';

// Client-side wallet store: React context + useReducer, persisted to
// localStorage. Everything is demo-local — no network, no Supabase.

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Pocket, Tx, WalletState } from './types';
import { txReference } from './format';
import { NAIJA_STORES } from './stores';

const KEY = 'naijapay_wallet_v1';

const STARTER_TXS: Tx[] = [
  {
    id: 'seed-1',
    kind: 'topup',
    amountKobo: 2500000,
    createdAt: new Date(Date.now() - 6 * 86400_000).toISOString(),
    title: 'Wallet top-up',
    sub: 'Bank transfer · demo',
    reference: txReference(),
  },
  {
    id: 'seed-2',
    kind: 'naijavend-payment',
    amountKobo: -350000,
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    title: 'Amaka Glow Studio',
    sub: 'Naijavend payment · Braids & beads',
    storeId: 'st-amaka',
    note: 'Knotless braids booking deposit',
    reference: txReference(),
  },
  {
    id: 'seed-3',
    kind: 'savings',
    amountKobo: -1000000,
    createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    title: 'New shop pocket',
    sub: 'Moved to savings · 8% p.a.',
    reference: txReference(),
  },
];

function seed(): WalletState {
  return {
    balanceKobo: 2500000 - 350000 - 1000000,
    txs: STARTER_TXS,
    pockets: [
      { id: 'pk-shop', name: 'New shop', emoji: '🏪', amountKobo: 1000000, rate: 0.08, createdAt: new Date(Date.now() - 3 * 86400_000).toISOString() },
      { id: 'pk-rainy', name: 'Rainy day', emoji: '☔', amountKobo: 500000, rate: 0.1, createdAt: new Date(Date.now() - 30 * 86400_000).toISOString() },
    ],
    pin: '1234',
  };
}

function load(): WalletState {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as WalletState;
    if (
      typeof parsed.balanceKobo !== 'number' ||
      !Array.isArray(parsed.txs) ||
      !Array.isArray(parsed.pockets) ||
      typeof parsed.pin !== 'string' ||
      !/^\d{4}$/.test(parsed.pin)
    ) {
      return seed();
    }
    return parsed;
  } catch {
    return seed();
  }
}

type Action =
  | { type: 'reset' }
  | { type: 'topup'; amountKobo: number; method: string }
  | { type: 'pay'; storeId: string; amountKobo: number; note: string }
  | { type: 'save'; pocketId: string; amountKobo: number }
  | { type: 'withdraw'; pocketId: string; amountKobo: number }
  | { type: 'create-pocket'; name: string; emoji: string; amountKobo: number; rate: number }
  | { type: 'refund'; txId: string }
  | { type: 'set-pin'; pin: string };

function reducer(state: WalletState, action: Action): WalletState {
  switch (action.type) {
    case 'reset':
      return seed();

    case 'topup': {
      const tx: Tx = {
        id: `tx-${Date.now()}`,
        kind: 'topup',
        amountKobo: action.amountKobo,
        createdAt: new Date().toISOString(),
        title: 'Wallet top-up',
        sub: `${action.method} · demo`,
        reference: txReference(),
      };
      return { ...state, balanceKobo: state.balanceKobo + action.amountKobo, txs: [tx, ...state.txs] };
    }

    case 'pay': {
      const store = NAIJA_STORES.find((s) => s.id === action.storeId);
      const tx: Tx = {
        id: `tx-${Date.now()}`,
        kind: 'naijavend-payment',
        amountKobo: -Math.abs(action.amountKobo),
        createdAt: new Date().toISOString(),
        title: store?.name ?? 'Naijavend store',
        sub: `Naijavend payment${action.note ? ` · ${action.note}` : ''}`,
        storeId: action.storeId,
        note: action.note || undefined,
        reference: txReference(),
      };
      return { ...state, balanceKobo: state.balanceKobo - Math.abs(action.amountKobo), txs: [tx, ...state.txs] };
    }

    case 'save': {
      const pocket = state.pockets.find((p) => p.id === action.pocketId);
      if (!pocket) return state;
      const amt = Math.abs(action.amountKobo);
      const tx: Tx = {
        id: `tx-${Date.now()}`,
        kind: 'savings',
        amountKobo: -amt,
        createdAt: new Date().toISOString(),
        title: pocket.name,
        sub: `Moved to savings · ${Math.round(pocket.rate * 100)}% p.a.`,
        reference: txReference(),
      };
      return {
        ...state,
        balanceKobo: state.balanceKobo - amt,
        txs: [tx, ...state.txs],
        pockets: state.pockets.map((p) => (p.id === pocket.id ? { ...p, amountKobo: p.amountKobo + amt } : p)),
      };
    }

    case 'withdraw': {
      const pocket = state.pockets.find((p) => p.id === action.pocketId);
      if (!pocket) return state;
      const amt = Math.min(Math.abs(action.amountKobo), pocket.amountKobo);
      if (amt <= 0) return state;
      const tx: Tx = {
        id: `tx-${Date.now()}`,
        kind: 'refund',
        amountKobo: amt,
        createdAt: new Date().toISOString(),
        title: `Withdrawal · ${pocket.name}`,
        sub: 'Savings back to wallet · demo',
        reference: txReference(),
      };
      return {
        ...state,
        balanceKobo: state.balanceKobo + amt,
        txs: [tx, ...state.txs],
        pockets: state.pockets.map((p) => (p.id === pocket.id ? { ...p, amountKobo: p.amountKobo - amt } : p)),
      };
    }

    case 'create-pocket': {
      const pocket: Pocket = {
        id: `pk-${Date.now()}`,
        name: action.name,
        emoji: action.emoji,
        amountKobo: Math.abs(action.amountKobo),
        rate: action.rate,
        createdAt: new Date().toISOString(),
      };
      // Optionally fund it immediately from the balance via a savings tx.
      if (pocket.amountKobo > 0) {
        const tx: Tx = {
          id: `tx-${Date.now()}`,
          kind: 'savings',
          amountKobo: -pocket.amountKobo,
          createdAt: new Date().toISOString(),
          title: pocket.name,
          sub: `New pocket · ${Math.round(pocket.rate * 100)}% p.a.`,
          reference: txReference(),
        };
        return {
          ...state,
          balanceKobo: state.balanceKobo - pocket.amountKobo,
          txs: [tx, ...state.txs],
          pockets: [...state.pockets, pocket],
        };
      }
      return { ...state, pockets: [...state.pockets, pocket] };
    }

    case 'refund': {
      const tx = state.txs.find((t) => t.id === action.txId);
      if (!tx || tx.kind !== 'naijavend-payment') return state;
      // Guard against refunding the same payment twice (e.g. after a page revisit).
      if (state.txs.some((t) => t.kind === 'refund' && t.refundedFrom === tx.id)) return state;
      const amt = Math.abs(tx.amountKobo);
      const refundTx: Tx = {
        id: `tx-${Date.now()}`,
        kind: 'refund',
        amountKobo: amt,
        createdAt: new Date().toISOString(),
        title: `${tx.title} refund`,
        sub: 'Store refund · demo',
        reference: txReference(),
        refundedFrom: tx.id,
      };
      return { ...state, balanceKobo: state.balanceKobo + amt, txs: [refundTx, ...state.txs] };
    }

    case 'set-pin':
      return { ...state, pin: action.pin };
  }
}

interface WalletApi {
  state: WalletState;
  topUp: (amountKobo: number, method: string) => void;
  payStore: (storeId: string, amountKobo: number, note: string) => void;
  saveTo: (pocketId: string, amountKobo: number) => void;
  withdrawFrom: (pocketId: string, amountKobo: number) => void;
  createPocket: (name: string, emoji: string, amountKobo: number, rate: number) => void;
  refundTx: (txId: string) => void;
  setPin: (pin: string) => void;
  resetWallet: () => void;
}

const Ctx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, load);
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full/blocked — demo keeps running in memory
    }
  }, [state]);

  const api = useMemo<WalletApi>(
    () => ({
      state,
      topUp: (amountKobo, method) => dispatch({ type: 'topup', amountKobo, method }),
      payStore: (storeId, amountKobo, note) => dispatch({ type: 'pay', storeId, amountKobo, note }),
      saveTo: (pocketId, amountKobo) => dispatch({ type: 'save', pocketId, amountKobo }),
      withdrawFrom: (pocketId, amountKobo) => dispatch({ type: 'withdraw', pocketId, amountKobo }),
      createPocket: (name, emoji, amountKobo, rate) => dispatch({ type: 'create-pocket', name, emoji, amountKobo, rate }),
      refundTx: (txId) => dispatch({ type: 'refund', txId }),
      setPin: (pin) => dispatch({ type: 'set-pin', pin }),
      resetWallet: () => {
        try {
          localStorage.removeItem(KEY);
        } catch {
          // ignore
        }
        dispatch({ type: 'reset' });
      },
    }),
    [state]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

/** Persisted "session unlocked" flag — the demo lock screen re-arms per browser session. */
const UNLOCK_KEY = 'naijapay_unlocked_v1';

export function useSessionLock() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = still hydrating
  useEffect(() => {
    setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === '1');
  }, []);
  const unlock = () => {
    sessionStorage.setItem(UNLOCK_KEY, '1');
    setUnlocked(true);
  };
  const lock = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  };
  return { unlocked, unlock, lock };
}
