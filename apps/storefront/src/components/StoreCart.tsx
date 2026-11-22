'use client';

// Store cart + guest checkout (BUILD.md T05/T08, REDESIGN_V2 §9). A sheet with
// four short steps: Cart → Contact → Delivery (method or campus zone, Ilorin
// area, address, landmark and an optional map pin) → Pay & review. One cart
// per store; everything shown here is a preview — /api/create-order re-prices
// every line, fee and discount on the server. Manual payment methods only:
// Kwaravend never takes card payments (a provider plugs in later behind
// lib/payments.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Check,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CART_EVENT, cartCount, cartSubtotalKobo, clearCart, readCart, removeFromCart, setQuantity, type CartItem } from '@/lib/cart';
import { PAYMENT_METHODS } from '@/lib/payments';
import { ILORIN_AREAS, ILORIN_AREAS_SORTED } from '@/lib/ilorin';
import { readArea } from '@/components/shell/AreaSelector';
import { SPRING, T } from '@/lib/motion';
import { formatNaira } from '@idevtenancy/shared';
import type { Pin } from '@/components/checkout/DeliveryPinMap';
import '../styles/checkout.css';
import { trackEvent } from '@/lib/track-event';

// The map is its own lazy chunk: it loads only when the buyer reaches delivery.
const DeliveryPinMap = dynamic(() => import('@/components/checkout/DeliveryPinMap').then((m) => m.DeliveryPinMap), {
  ssr: false,
  loading: () => <div className="kv-pin-map kv-pin-loading" aria-hidden />,
});

interface DeliveryOption {
  method: string;
  label: string;
  feeKobo: number;
}
interface Zone {
  id: string;
  label: string;
  feeKobo: number;
}
type Step = 0 | 1 | 2 | 3;
const STEPS = ['Cart', 'Contact', 'Delivery', 'Pay'];
const METHOD_ICON: Record<string, LucideIcon> = { pickup: StoreIcon, rider: Bike, courier: Truck };
type PayId = (typeof PAYMENT_METHODS)[number]['id'];

export function StoreCart({ slug, storeName }: { slug: string; storeName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  // '' = arrange with the seller; 'pickup' | 'rider' | 'courier' | 'zone:<id>'
  const [delivery, setDelivery] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pin, setPin] = useState<Pin>(null);
  const [showMap, setShowMap] = useState(false);
  const [payment, setPayment] = useState<PayId>('cash_on_delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [promo, setPromo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  const sync = useCallback(() => setItems(readCart(slug)), [slug]);

  useEffect(() => {
    sync();
    const onChange = () => {
      sync();
      if (readCart(slug).length > 0) setOpen(true);
    };
    window.addEventListener(CART_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CART_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [slug, sync]);

  // Remembered details: the buyer's area (from the area dropdown) and contact.
  useEffect(() => {
    const a = readArea();
    if (a && ILORIN_AREAS.some((x) => x.id === a)) setArea(a);
    try {
      const saved = JSON.parse(window.localStorage.getItem('kv-buyer') ?? '{}') as { name?: string; phone?: string };
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {
      /* private mode or bad JSON */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/delivery-options?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { options?: DeliveryOption[]; zones?: Zone[] };
        if (!alive) return;
        setOptions(json.options ?? []);
        setZones(json.zones ?? []);
        if (json.options?.length) setDelivery((d) => d || json.options![0]!.method);
      } catch {
        // No structured options — the order still goes through, arranged with the seller.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setError('');
    panelRef.current?.querySelector('.kv-co-body')?.scrollTo({ top: 0 });
  }, [step]);
  // Fixing the problem clears the message straight away.
  useEffect(() => {
    setError('');
  }, [name, phone, delivery, area, address, landmark, pin]);

  const count = cartCount(items);
  const subtotal = cartSubtotalKobo(items);
  const zoneId = delivery.startsWith('zone:') ? delivery.slice(5) : '';
  const method = zoneId ? 'zone' : delivery;
  const delivering = method === 'rider' || method === 'courier';
  const fee = useMemo(
    () => (zoneId ? zones.find((z) => z.id === zoneId)?.feeKobo : options.find((o) => o.method === delivery)?.feeKobo) ?? 0,
    [options, zones, delivery, zoneId],
  );
  const areaInfo = ILORIN_AREAS.find((a) => a.id === area) ?? null;
  const payChoices = useMemo(
    () => PAYMENT_METHODS.filter((m) => (method === 'pickup' ? m.id !== 'cash_on_delivery' : m.id !== 'pay_on_pickup')),
    [method],
  );
  useEffect(() => {
    if (!payChoices.some((m) => m.id === payment) && payChoices[0]) setPayment(payChoices[0].id);
  }, [payChoices, payment]);

  function check(s: Step): string {
    if (s === 1) {
      if (name.trim().length < 2) return 'Enter your name.';
      if (!/^\+?\d[\d\s-]{9,15}$/.test(phone.trim())) return 'Enter a phone number, e.g. +2348012345678.';
    }
    if (s === 2 && delivering) {
      if (!areaInfo) return 'Pick your area in Ilorin.';
      if (address.trim().length < 4 && landmark.trim().length < 4 && !pin) return 'Add an address, a landmark or a pin so the rider can find you.';
    }
    return '';
  }
  function next() {
    const msg = check(step);
    if (msg) return setError(msg);
    if (step === 0) trackEvent('checkout_started', { slug });
    setStep((s) => Math.min(3, s + 1) as Step);
  }

  async function placeOrder() {
    for (const s of [1, 2] as Step[]) {
      const msg = check(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      try {
        window.localStorage.setItem('kv-buyer', JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      } catch {
        /* private mode */
      }
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Prevents a double-tap from creating two orders.
          'idempotency-key': `${slug}:${items.map((i) => `${i.listingId}x${i.quantity}`).join(',')}:${Math.floor(Date.now() / 60000)}`,
        },
        body: JSON.stringify({
          slug,
          items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
          customerName: name.trim(),
          customerPhone: normalisePhone(phone),
          deliveryMethod: method || undefined,
          deliveryZone: zoneId || undefined,
          deliveryArea: delivering ? area : undefined,
          deliveryAddress: method && method !== 'pickup' ? address.trim() : undefined,
          deliveryLandmark: method && method !== 'pickup' ? landmark.trim() : undefined,
          dropLat: delivering && pin ? pin.lat : undefined,
          dropLng: delivering && pin ? pin.lng : undefined,
          paymentMethod: payment,
          promoCode: promo.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { orderId?: string; payToken?: string; error?: { message?: string } };
      if (!res.ok || !body.orderId) {
        setError(body.error?.message ?? 'Could not place this order. Check your details and try again.');
        return;
      }
      clearCart(slug);
      setOpen(false);
      setStep(0);
      // The token lets a guest upload a transfer receipt for this order.
      router.push(body.payToken ? `/checkout/${body.orderId}?pt=${body.payToken}` : `/checkout/${body.orderId}`);
    } catch {
      setError('Network problem. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (count === 0 && !open) return null;

  const deliveryChoices: Array<{ id: string; label: string; fee: number; Icon: LucideIcon; hint?: string }> = [
    ...options.map((o) => ({
      id: o.method,
      label: o.method === 'pickup' ? 'Pick up' : o.label,
      fee: o.feeKobo,
      Icon: METHOD_ICON[o.method] ?? Truck,
      hint: o.method === 'pickup' ? 'Collect it from the store' : 'Delivered in Ilorin',
    })),
    ...zones.map((z) => ({ id: `zone:${z.id}`, label: `Delivery to ${z.label}`, fee: z.feeKobo, Icon: Building2, hint: 'Campus / landmark drop-off' })),
  ];

  return (
    <>
      <button type="button" className="btn btn-primary kv-co-fab" onClick={() => setOpen(true)}>
        <ShoppingCart size={18} aria-hidden /> View cart · {count} · {formatNaira(subtotal)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="kv-co-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={T.base}
            onClick={(e: { target: EventTarget; currentTarget: EventTarget }) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Cart and checkout for ${storeName}`}
              tabIndex={-1}
              className="kv-co"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={SPRING.sheet}
            >
              <div className="kv-co-head">
                {step > 0 ? (
                  <button type="button" className="kv-co-icon" aria-label="Back" onClick={() => setStep((s) => (s - 1) as Step)}>
                    <ArrowLeft size={18} aria-hidden />
                  </button>
                ) : (
                  <span className="kv-co-icon is-plain" aria-hidden>
                    <ShoppingCart size={18} />
                  </span>
                )}
                <div className="kv-co-title">
                  <h2>{step === 0 ? 'Your cart' : 'Checkout'}</h2>
                  <span>{storeName}</span>
                </div>
                <button type="button" className="kv-co-icon" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={18} aria-hidden />
                </button>
              </div>

              {items.length > 0 && (
                <ol className="kv-co-steps" aria-label="Checkout steps">
                  {STEPS.map((label, i) => (
                    <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                      <span className="kv-co-dot">{i < step ? <Check size={12} aria-hidden /> : i + 1}</span>
                      {label}
                    </li>
                  ))}
                </ol>
              )}

              <div className="kv-co-body">
                {items.length === 0 ? (
                  <div className="kv-co-empty">
                    <Package size={26} aria-hidden />
                    <p>Your cart is empty.</p>
                    <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                      Keep shopping
                    </button>
                  </div>
                ) : step === 0 ? (
                  <ul className="kv-co-items">
                    {items.map((i) => (
                      <li key={i.listingId} className="kv-co-item">
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                          <img src={i.image} alt="" className="kv-co-thumb" />
                        ) : (
                          <span className="kv-co-thumb is-empty" aria-hidden>
                            <Package size={18} />
                          </span>
                        )}
                        <span className="kv-co-item-main">
                          <strong>{i.title}</strong>
                          <span className="kv-co-money">{formatNaira(i.priceKobo)} each</span>
                        </span>
                        <span className="kv-co-qty" role="group" aria-label={`Quantity of ${i.title}`}>
                          <button type="button" aria-label={`One fewer ${i.title}`} onClick={() => setQuantity(slug, i.listingId, i.quantity - 1)}>
                            <Minus size={14} aria-hidden />
                          </button>
                          <span className="kv-co-money">{i.quantity}</span>
                          <button type="button" aria-label={`One more ${i.title}`} onClick={() => setQuantity(slug, i.listingId, i.quantity + 1)}>
                            <Plus size={14} aria-hidden />
                          </button>
                        </span>
                        <button type="button" className="kv-co-icon is-sm" aria-label={`Remove ${i.title}`} onClick={() => removeFromCart(slug, i.listingId)}>
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : step === 1 ? (
                  <div className="kv-co-form">
                    <label className="kv-co-field">
                      <span>Your name</span>
                      <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Aisha Bello" />
                    </label>
                    <label className="kv-co-field">
                      <span>Phone (WhatsApp if you have it)</span>
                      <input
                        className="input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+2348012345678"
                      />
                    </label>
                    <p className="kv-co-hint">The seller uses this to confirm your order. No account needed.</p>
                  </div>
                ) : step === 2 ? (
                  <div className="kv-co-form">
                    {deliveryChoices.length > 0 ? (
                      <div className="kv-co-choices" role="radiogroup" aria-label="How do you want it?">
                        {deliveryChoices.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={delivery === c.id}
                            className={delivery === c.id ? 'kv-co-choice is-on' : 'kv-co-choice'}
                            onClick={() => setDelivery(c.id)}
                          >
                            <c.Icon size={18} aria-hidden />
                            <span>
                              <strong>{c.label}</strong>
                              {c.hint && <em>{c.hint}</em>}
                            </span>
                            <span className="kv-co-money">{c.fee > 0 ? formatNaira(c.fee) : 'Free'}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="kv-co-hint">This store arranges pickup or delivery with you after you order.</p>
                    )}

                    {delivering && (
                      <>
                        <label className="kv-co-field">
                          <span>Your area in Ilorin</span>
                          <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
                            <option value="">Pick your area</option>
                            {ILORIN_AREAS_SORTED.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="kv-co-field">
                          <span>Address</span>
                          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="House number and street" />
                        </label>
                        <label className="kv-co-field">
                          <span>Landmark (how to find you)</span>
                          <input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Opposite the mosque, blue gate" />
                        </label>
                        <div className="kv-co-mapblock">
                          <div className="kv-co-maphead">
                            <strong>Drop a pin (optional)</strong>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
                              {showMap ? 'Hide map' : pin ? 'Edit pin' : 'Open map'}
                            </button>
                          </div>
                          {showMap && <DeliveryPinMap center={areaInfo ? { lat: areaInfo.lat, lng: areaInfo.lng } : null} value={pin} onChange={setPin} />}
                          {!showMap && pin && <p className="kv-co-hint">Pin set on the map.</p>}
                        </div>
                      </>
                    )}
                    {zoneId && (
                      <label className="kv-co-field">
                        <span>Where exactly (hostel, faculty, gate)</span>
                        <input className="input" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Faculty of Law car park" />
                      </label>
                    )}
                    {method === 'pickup' && <p className="kv-co-hint">The seller confirms when it is ready and how to find the store.</p>}
                  </div>
                ) : (
                  <div className="kv-co-form">
                    <div className="kv-co-choices" role="radiogroup" aria-label="How will you pay?">
                      {payChoices.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={payment === m.id}
                          className={payment === m.id ? 'kv-co-choice is-on' : 'kv-co-choice'}
                          onClick={() => setPayment(m.id)}
                        >
                          <span>
                            <strong>{m.label}</strong>
                            <em>{m.hint}</em>
                          </span>
                        </button>
                      ))}
                    </div>
                    <label className="kv-co-field">
                      <span>Discount code (optional)</span>
                      <input className="input" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="e.g. UNILORIN10" autoCapitalize="characters" />
                    </label>
                    <label className="kv-co-field">
                      <span>Note to the seller (optional)</span>
                      <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Size, colour, delivery time…" maxLength={300} />
                    </label>
                    <div className="kv-co-review">
                      <p>
                        <strong>{name}</strong> · {phone}
                      </p>
                      <p>
                        {method === 'pickup'
                          ? 'Pick up from the store'
                          : zoneId
                            ? `Delivery to ${zones.find((z) => z.id === zoneId)?.label ?? 'your zone'}${landmark ? `, ${landmark}` : ''}`
                            : delivering
                              ? `Delivery to ${[address, landmark, areaInfo?.label].filter(Boolean).join(', ')}${pin ? ' (pin on map)' : ''}`
                              : 'Pickup or delivery arranged with the seller'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="kv-co-foot">
                  <div className="kv-co-totals">
                    <span>
                      <em>Items</em> <span className="kv-co-money">{formatNaira(subtotal)}</span>
                    </span>
                    {fee > 0 && (
                      <span>
                        <em>Delivery</em> <span className="kv-co-money">{formatNaira(fee)}</span>
                      </span>
                    )}
                    <span className="is-total">
                      <em>Total</em> <strong className="kv-co-money">{formatNaira(subtotal + fee)}</strong>
                    </span>
                    {promo.trim() && step === 3 && <em className="kv-co-hint">Your discount is applied when you place the order.</em>}
                  </div>
                  {error && (
                    <p className="kv-co-error" role="alert">
                      {error}
                    </p>
                  )}
                  {step < 3 ? (
                    <button type="button" className="btn btn-primary btn-lg kv-co-next" onClick={next}>
                      {step === 0 ? 'Checkout' : 'Continue'} <ArrowRight size={17} aria-hidden />
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-lg kv-co-next" onClick={placeOrder} disabled={busy} aria-busy={busy}>
                      {busy ? 'Placing order…' : `Place order · ${formatNaira(subtotal + fee)}`}
                    </button>
                  )}
                  <p className="kv-co-hint">You pay the seller directly. Kwaravend takes no card payments and adds no fee.</p>
                  {step === 3 && (
                    <p className="kv-co-hint">
                      Changed your mind? Message the seller before they confirm. Cancellations and refunds are agreed with the
                      seller; if something goes wrong, signed-in buyers can open a dispute from My account.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** "0801 234 5678" → "+2348012345678"; anything else is sent as typed (minus spaces). */
function normalisePhone(raw: string): string {
  const p = raw.replace(/[\s-]/g, '');
  if (/^0\d{10}$/.test(p)) return `+234${p.slice(1)}`;
  if (/^234\d{10}$/.test(p)) return `+${p}`;
  return p;
}
