import Link from 'next/link';
import { formatNaira } from '@idevtenancy/shared';
import { CalendarDays, ShoppingBag, Store } from 'lucide-react';

export interface ProductCardItem {
  id: string;
  title: string;
  priceKobo: number;
  type: string;
  imageUrl: string | null;
  storeName: string;
  storeSlug: string;
  compareAtKobo?: number | null;
  stock?: number | null;
}

// Shared product tile: homepage trending, search results, and anywhere a
// compact listing card is needed. Links straight to the listing detail page.
// Shopify-style merchandising: Sale badge + strikethrough, Sold out / Low stock.
export function ProductCard({ item }: { item: ProductCardItem }) {
  const onSale = item.compareAtKobo != null && item.compareAtKobo > item.priceKobo;
  const soldOut = item.stock === 0;
  const lowStock = !soldOut && item.stock != null && item.stock <= 3;
  const pctOff = onSale ? Math.round((1 - item.priceKobo / (item.compareAtKobo as number)) * 100) : 0;

  return (
    <Link href={`/s/${item.storeSlug}/listing/${item.id}`} className="product-card">
      <div className="product-card-media">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
          <img className="product-card-img" src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="product-card-img-ph" aria-hidden>{item.type === 'service' ? <CalendarDays size={28} /> : <ShoppingBag size={28} />}</div>
        )}
        {onSale && <span className="product-badge badge-sale">Sale · {pctOff}% off</span>}
        {soldOut && <span className="product-badge badge-soldout">Sold out</span>}
        {!soldOut && lowStock && <span className="product-badge badge-lowstock">Only {item.stock} left</span>}
      </div>
      <div className="product-card-body">
        <span className="product-card-meta">{item.type}</span>
        <h3 className="product-card-title">{item.title}</h3>
        <span className="product-card-store"><Store size={13} aria-hidden /> <span>{item.storeName}</span></span>
        <span className="product-card-priceline">
          <span className="product-card-price">{formatNaira(item.priceKobo)}</span>
          {onSale && <span className="product-card-compare">{formatNaira(item.compareAtKobo as number)}</span>}
        </span>
      </div>
    </Link>
  );
}
