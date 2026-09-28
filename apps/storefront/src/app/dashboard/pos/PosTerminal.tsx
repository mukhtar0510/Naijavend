'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatNaira } from '@idevtenancy/shared';

export interface PosListing {
  id: string;
  title: string;
  price_kobo: number;
  stock: number | null;
  type: string;
  image_url: string | null;
}

export interface PosProps {
  listings: PosListing[];
  slug: string;
  isGrowth: boolean;
  staffName: string | null;
}

type TicketLine = { id: string; title: string; price_kobo: number; qty: number };

// POS terminal: tap products to build a ticket, take payment, done.
// Charges go through /api/pos/charge which re-prices from the DB and
// records a real, instantly-paid order — stock and analytics included.
export function PosTerminal({ listings, slug, isGrowth, staffName }: PosProps) {
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ total: number; method: string; orderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const products = useMemo(
    () =>
      listings.filter(
        (l) => l.type === 'product' && (!q || l.title.toLowerCase().includes(q.toLowerCase()))
      ),
    [listings, q]
  );

  const total = ticket.reduce((s, l) => s + l.price_kobo * l.qty, 0);

  function add(l: PosListing) {
    setError(null);
    setTicket((t) => {
      const existing = t.find((x) => x.id === l.id);
      if (existing) {
        if (l.stock != null && existing.qty >= l.stock) {
          setError(`Only ${l.stock} of "${l.title}" in stock.`);
          return t;
        }
        return t.map((x) => (x.id === l.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...t, { id: l.id, title: l.title, price_kobo: l.price_kobo, qty: 1 }];
    });
  }

  function bump(id: string, delta: number) {
    setTicket((t) =>
      t
        .map((x) => (x.id === id ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0)
    );
  }

  async function charge() {
    if (ticket.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/pos/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: ticket.map((l) => ({ listingId: l.id, quantity: l.qty })),
          method,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Charge failed.');
        return;
      }
      setReceipt({ total: json.totalKobo, method, orderId: json.orderId });
      setTicket([]);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-shell">
      <div className="pos-products">
        <input
          className="pos-search"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search products"
        />
        <div className="pos-grid">
          {products.map((l) => {
            const soldOut = l.stock === 0;
            return (
              <button
                key={l.id}
                type="button"
                className="pos-tile"
                onClick={() => add(l)}
                disabled={soldOut}
                title={soldOut ? 'Sold out' : l.title}
              >
                {l.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                  <img src={l.image_url} alt="" />
                ) : (
                  <span className="pos-tile-fallback" aria-hidden>🛍️</span>
                )}
                <span className="pos-tile-name">{l.title}</span>
                <span className="pos-tile-price">{formatNaira(l.price_kobo)}</span>
                {l.stock != null && <span className="pos-tile-stock">{soldOut ? 'Sold out' : `${l.stock} left`}</span>}
              </button>
            );
          })}
          {products.length === 0 && <p className="muted">No products match.</p>}
        </div>
      </div>

      <aside className="pos-ticket">
        <h3>Ticket</h3>
        {staffName && <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>Cashier: {staffName}</p>}
        {ticket.length === 0 && <p className="muted">Tap products to add them.</p>}
        {ticket.map((l) => (
          <div key={l.id} className="pos-line">
            <span className="pos-line-name">{l.title}</span>
            <div className="pos-line-qty">
              <button type="button" onClick={() => bump(l.id, -1)} aria-label={`Less ${l.title}`}>−</button>
              <span>{l.qty}</span>
              <button type="button" onClick={() => bump(l.id, 1)} aria-label={`More ${l.title}`}>+</button>
            </div>
            <span className="pos-line-total">{formatNaira(l.price_kobo * l.qty)}</span>
          </div>
        ))}

        <div className="pos-total">
          <span>Total</span>
          <strong>{formatNaira(total)}</strong>
        </div>

        <div className="pos-methods" role="radiogroup" aria-label="Payment method">
          {(['cash', 'transfer', 'card'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              className={`pos-method${method === m ? ' is-active' : ''}`}
              onClick={() => setMethod(m)}
            >
              {m === 'cash' ? '💵 Cash' : m === 'transfer' ? '🏦 Transfer' : '💳 Card'}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-lg pos-charge" type="button" onClick={charge} disabled={ticket.length === 0 || busy}>
          {busy ? 'Charging…' : `Charge ${formatNaira(total)}`}
        </button>
        {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}

        {receipt && (
          <div className="alert alert-success" style={{ marginTop: 10 }} role="status">
            ✅ Paid {formatNaira(receipt.total)} via {receipt.method}. Sale recorded.
          </div>
        )}
      </aside>
    </div>
  );
}
