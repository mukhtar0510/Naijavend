'use client';

import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { getRecentProducts } from '@/components/RecordProductView';

// "Recently viewed" products section on My account — reads the local history
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
    <section className="card card-elevated recent-section" aria-label="Recently viewed products">
      <div className="recent-head">
        <h2>👀 Recently viewed products</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Products you looked at recently, so you can buy again.
        </span>
      </div>
      <div className="product-row" style={{ marginTop: 14 }}>
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
