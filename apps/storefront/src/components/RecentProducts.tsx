'use client';

import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { getRecentProducts } from '@/components/RecordProductView';

// "Recently viewed" product row on My account — reads the local history
// recorded on listing pages. ProductCard renders the stock badges.
export function RecentProducts() {
  const [items, setItems] = useState<ProductCardItem[]>([]);

  useEffect(() => {
    setItems(
      getRecentProducts().map((p) => ({
        id: p.id,
        title: p.title,
        priceKobo: p.priceKobo,
        type: p.type,
        imageUrl: p.imageUrl,
        storeName: p.storeName,
        storeSlug: p.storeSlug,
        compareAtKobo: p.compareAtKobo,
        stock: p.stock,
      }))
    );
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="history-row" aria-label="Recently viewed products">
      <h2>👀 Recently viewed products</h2>
      <div className="product-row" style={{ marginTop: 14 }}>
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
