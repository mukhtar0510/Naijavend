'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProductCardItem } from '@/components/ProductCard';

// Homepage hero search: searches products AND services AND stores from one box.
// Shows trending product chips when order data exists, helpful examples otherwise.
const FALLBACK_CHIPS = ['cakes', 'braids', 'phone repair', 'sneakers', 'tutoring'];

export function HeroSearch({ trending }: { trending: ProductCardItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (kind !== 'all') params.set('kind', kind);
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  const chips = trending.length > 0
    ? trending.slice(0, 4).map((t) => ({ label: `🔥 ${t.title}`, query: t.title }))
    : FALLBACK_CHIPS.map((c) => ({ label: c, query: c }));

  return (
    <div style={{ marginTop: 4 }}>
      <form className="hero-search" onSubmit={submit} role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products, services or stores…"
          aria-label="Search products, services or stores"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Search category">
          <option value="all">Everything</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
          <option value="store">Stores</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      <div className="hero-trending">
        <span className="hero-trending-label">{trending.length > 0 ? 'Trending' : 'Try'}</span>
        {chips.map((chip) => (
          <button
            key={chip.query}
            type="button"
            className="trend-chip"
            onClick={() => router.push(`/search?q=${encodeURIComponent(chip.query)}&kind=product`)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
