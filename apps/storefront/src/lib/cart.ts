// Cart storage — one cart per store, kept in localStorage so a guest can shop
// without an account and without a server round trip. Totals shown here are a
// preview only: /api/create-order re-prices every line from the database.

export interface CartItem {
  listingId: string;
  title: string;
  priceKobo: number;
  image: string | null;
  quantity: number;
}

export const CART_EVENT = 'kv-cart-change';
const MAX_QTY = 99;

function key(slug: string): string {
  return `kv-cart:${slug}`;
}

function isItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false;
  const i = v as Record<string, unknown>;
  return (
    typeof i.listingId === 'string' &&
    typeof i.title === 'string' &&
    typeof i.priceKobo === 'number' &&
    typeof i.quantity === 'number'
  );
}

export function readCart(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isItem).map((i) => ({
      ...i,
      quantity: Math.max(1, Math.min(MAX_QTY, Math.round(i.quantity))),
    }));
  } catch {
    return [];
  }
}

function writeCart(slug: string, items: CartItem[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(key(slug));
    else window.localStorage.setItem(key(slug), JSON.stringify(items));
  } catch {
    // Storage disabled/full: the cart stays in memory for this page view.
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { slug } }));
}

export function addToCart(slug: string, item: Omit<CartItem, 'quantity'>, quantity = 1): CartItem[] {
  const items = readCart(slug);
  const existing = items.find((i) => i.listingId === item.listingId);
  if (existing) {
    existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
  } else {
    items.push({ ...item, quantity: Math.min(MAX_QTY, Math.max(1, quantity)) });
  }
  writeCart(slug, items);
  return items;
}

export function setQuantity(slug: string, listingId: string, quantity: number): CartItem[] {
  const items = readCart(slug)
    .map((i) => (i.listingId === listingId ? { ...i, quantity: Math.max(0, Math.min(MAX_QTY, quantity)) } : i))
    .filter((i) => i.quantity > 0);
  writeCart(slug, items);
  return items;
}

export function removeFromCart(slug: string, listingId: string): CartItem[] {
  const items = readCart(slug).filter((i) => i.listingId !== listingId);
  writeCart(slug, items);
  return items;
}

export function clearCart(slug: string): void {
  writeCart(slug, []);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotalKobo(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.priceKobo * i.quantity, 0);
}
