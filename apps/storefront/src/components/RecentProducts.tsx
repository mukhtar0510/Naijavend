'use client';

import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardItem } from '@/components/ProductCard';
import { getRecentProducts } from '@/components/RecordProductView';
import { Eye as IcEye } from 'lucide-react';

// "Recently viewed" products section on My account — reads the local history
// recorded on listing pages. Products that have since been removed (or belong
// to a deleted store) are filtered out and pruned from storage.
export function RecentProducts() {
  const [items, setItems] = useState<ProductCardItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const history = getRecentProducts();
    if (history.length === 0) {
      setLoaded(true);
      return;
    }

    const toCards = (list: typeof history): ProductCardItem[] =>
      list.map((p) => ({
        id: p.id,
        title: p.title,
        priceKobo: p.priceKobo,
        type: p.type,
        imageUrl: p.imageUrl,
        storeName: p.storeName,
        storeSlug: p.storeSlug,
        compareAtKobo: p.compareAtKobo,
        stock: p.stock,
      }));

    void (async () => {
      let live = history;
      try {
        const res = await fetch(
          `/api/recent/validate?listings=${encodeURIComponent(history.map((p) => p.id).join(','))}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = (await res.json()) as { listings?: string[] };
          const ids = new Set(data.listings ?? []);
          live = history.filter((p) => ids.has(p.id));
        }
      } catch {
        // Keep the history as-is when the check cannot run.
      }
      if (cancelled) return;
      setItems(toCards(live));
      setLoaded(true);
      if (live.length !== history.length) {
        try {
          window.localStorage.setItem('sf-recent-products', JSON.stringify(live));
        } catch {
          // Storage unavailable — nothing else to clean up.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="card card-elevated recent-section" aria-label="Recently viewed products">
      <div className="recent-head">
        <h2><IcEye className="ico-inline" aria-hidden /> Recently viewed products</h2>
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
