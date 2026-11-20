'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CART_EVENT,
  cartCount,
  cartSubtotalKobo,
  clearCart,
  readCart,
  removeFromCart,
  setQuantity,
  type CartItem,
} from '@/lib/cart';
import { PAYMENT_METHODS } from '@/lib/payments';
import { formatNaira } from '@idevtenancy/shared';
import { ShoppingCart as IcShoppingCart } from 'lucide-react';

interface DeliveryOption {
  method: string;
  label: string;
  feeKobo: number;
}

/**
 * Store cart: a bottom sheet with quantity controls and a guest checkout form.
 * One cart per store; totals are re-priced server-side by /api/create-order.
 */
export function StoreCart({ slug, storeName }: { slug: string; storeName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [delivery, setDelivery] = useState('');
  const [payment, setPayment] = useState<'cash_on_delivery' | 'bank_transfer' | 'pay_on_pickup'>('cash_on_delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  const sync = useCallback(() => setItems(readCart(slug)), [slug]);

  useEffect(() => {
    sync();
    const onChange = () => {
      sync();
      setOpen(readCart(slug).length > 0);
    };
    window.addEventListener(CART_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CART_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [slug, sync]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/delivery-options?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { options: DeliveryOption[] };
        if (!alive) return;
        setOptions(json.options ?? []);
        if (json.options?.length) setDelivery((d) => d || json.options[0]!.method);
      } catch {
        // No structured options — checkout still works with free-form delivery.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const count = cartCount(items);
  const subtotal = cartSubtotalKobo(items);
  const fee = useMemo(() => options.find((o) => o.method === delivery)?.feeKobo ?? 0, [options, delivery]);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Prevents a double-submit from creating two orders.
          'idempotency-key': `${slug}:${items.map((i) => `${i.listingId}x${i.quantity}`).join(',')}:${Math.floor(Date.now() / 60000)}`,
        },
        body: JSON.stringify({
          slug,
          items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
          customerName: name,
          customerPhone: phone,
          deliveryMethod: delivery || undefined,
          paymentMethod: payment,
        }),
      });
      const body = (await res.json()) as {
        orderId?: string;
        payToken?: string;
        error?: { message?: string };
      };
      if (!res.ok || !body.orderId) {
        setError(body.error?.message ?? 'Could not place this order. Check your details and try again.');
        return;
      }
      clearCart(slug);
      setOpen(false);
      // The token is what lets a guest upload a transfer receipt for this order.
      router.push(body.payToken ? `/checkout/${body.orderId}?pt=${body.payToken}` : `/checkout/${body.orderId}`);
    } catch {
      setError('Network problem — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (count === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, boxShadow: 'var(--shadow-lg)' }}
      >
        <IcShoppingCart className="ico-inline" aria-hidden /> Cart · {count} · {formatNaira(subtotal)}
      </button>

      {open && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,12,14,0.45)',
            zIndex: 70,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Cart for ${storeName}`}
            tabIndex={-1}
            style={{
              background: 'var(--surface, #fff)',
              width: 'min(420px, 100%)',
              overflowY: 'auto',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Your cart</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {items.length === 0 ? (
              <p className="muted">Your cart is empty.</p>
            ) : (
              <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                  {items.map((i) => (
                    <li key={i.listingId} className="card" style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 14 }}>{i.title}</strong>
                        <span className="muted" style={{ fontSize: 13 }}>{formatNaira(i.priceKobo)} each</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" aria-label={`Fewer ${i.title}`} onClick={() => setQuantity(slug, i.listingId, i.quantity - 1)}>
                          −
                        </button>
                        <span className="mono" style={{ minWidth: 18, textAlign: 'center' }}>{i.quantity}</span>
                        <button type="button" className="btn btn-outline btn-sm" aria-label={`More ${i.title}`} onClick={() => setQuantity(slug, i.listingId, i.quantity + 1)}>
                          +
                        </button>
                      </span>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => removeFromCart(slug, i.listingId)} aria-label={`Remove ${i.title}`}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <div style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">Subtotal</span>
                    <strong className="mono">{formatNaira(subtotal)}</strong>
                  </span>
                  {fee > 0 && (
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Delivery</span>
                      <strong className="mono">{formatNaira(fee)}</strong>
                    </span>
                  )}
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <span>Total</span>
                    <strong className="mono">{formatNaira(subtotal + fee)}</strong>
                  </span>
                </div>

                <form onSubmit={placeOrder} style={{ display: 'grid', gap: 10 }}>
                  <input
                    className="input"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                  <input
                    className="input"
                    placeholder="+2348012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  {options.length > 0 && (
                    <select className="input" value={delivery} onChange={(e) => setDelivery(e.target.value)} aria-label="Delivery option">
                      {options.map((o) => (
                        <option key={o.method} value={o.method}>
                          {o.label} · {formatNaira(o.feeKobo)}
                        </option>
                      ))}
                    </select>
                  )}
                  <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    <legend style={{ fontSize: 13, marginBottom: 4 }}>How will you pay?</legend>
                    {PAYMENT_METHODS.map((m) => (
                      <label key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                        <input type="radio" name="pay" value={m.id} checked={payment === m.id} onChange={() => setPayment(m.id)} />
                        {m.label}
                      </label>
                    ))}
                  </fieldset>
                  {error && <p className="muted" style={{ color: 'var(--danger, #b42318)', fontSize: 13, margin: 0 }}>{error}</p>}
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Placing order…' : 'Place order'}
                  </button>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                    You pay the seller directly. Kwaravend does not take card payments and adds no fee.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
