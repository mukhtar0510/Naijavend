'use client';

import { useState } from 'react';
import { addToCart, type CartItem } from '@/lib/cart';

/** Adds one listing to this store's cart and opens the drawer via the cart event. */
export function AddToCart({
  slug,
  item,
  compact = false,
}: {
  slug: string;
  item: Omit<CartItem, 'quantity'>;
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);

  function add() {
    addToCart(slug, item);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      type="button"
      className={`btn btn-outline ${compact ? 'btn-sm' : ''}`}
      onClick={add}
      aria-live="polite"
    >
      {added ? 'Added ' : 'Add to cart'}
    </button>
  );
}
