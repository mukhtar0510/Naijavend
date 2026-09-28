'use client';

import { useMemo, useState } from 'react';
import { STORE_CATEGORIES, STORE_CATEGORY_LABELS, STORE_CATEGORY_EMOJI } from '@idevtenancy/shared';

// One-line "what's in it" hints so sellers can tell categories apart at a glance
// (and so the search can match how people actually describe their business).
const HINTS: Record<string, string> = {
  beauty: 'salons, braids, makeup, nails',
  fashion: 'clothes, tailoring, boutiques',
  kitchen: 'pots, utensils, appliances',
  food: 'catering, chops, cakes, grills',
  groceries: 'foodstuff, provisions, supermarkets',
  crafts: 'crochet, beads, handmade art',
  fitness: 'gym, training, workout plans',
  education: 'tutoring, lessons, schools',
  'home-services': 'repairs, plumbing, cleaning',
  electronics: 'phones, laptops, gadgets',
  dropshippers: 'you ship from a supplier',
  general: 'anything else',
  software: 'apps, websites, SaaS, developers',
  'digital-products': 'ebooks, templates, online courses',
  gaming: 'consoles, games, gaming gear',
  marketing: 'social media, ads, branding agencies',
  'health-wellness': 'supplements, therapy, holistic care',
  'baby-kids': 'kids clothes, toys, childcare',
  pets: 'pet food, accessories, grooming',
  jewelry: 'necklaces, watches, custom pieces',
  photography: 'photographers, videographers, studios',
  music: 'instruments, DJs, sound systems',
  art: 'paintings, portraits, commissions',
  events: 'planners, decor, rentals, MCs',
  auto: 'spare parts, mechanics, detailing',
  agriculture: 'farm produce, poultry, livestock',
  'real-estate': 'agents, shortlets, land, housing',
  'professional-services': 'legal, accounting, consulting',
  logistics: 'couriers, dispatch riders, delivery',
  printing: 'banners, stationery, custom merch',
  furniture: 'sofas, interiors, carpentry',
  laundry: 'dry cleaning, cleaning services',
};

/**
 * Phone-friendly category picker: a trigger button that expands into a search
 * box + tappable card grid (a native <select> is cramped for 12 categories and
 * shows no hints). Controlled by the parent so the AI-draft flow can prefill.
 */
export function CategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const known = (STORE_CATEGORIES as readonly string[]).includes(value);
  const label = known ? (STORE_CATEGORY_LABELS as Record<string, string>)[value] ?? value : value;
  const emoji = (STORE_CATEGORY_EMOJI as Record<string, string>)[value] ?? '🛍️';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return STORE_CATEGORIES;
    return STORE_CATEGORIES.filter((c) =>
      `${STORE_CATEGORY_LABELS[c]} ${HINTS[c] ?? ''} ${c}`.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <div className="ob-catpicker">
      <button
        type="button"
        className="ob-cat-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="ob-type-ico" aria-hidden>{emoji}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        <span className="ob-cat-caret" aria-hidden>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ob-cat-panel">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — try 'food', 'crafts', 'gym'…"
            aria-label="Search categories"
          />
          <div className="ob-cat-grid" role="listbox" aria-label="Store category">
            {filtered.map((c) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={c === value}
                className={`ob-type-card ob-cat-card${c === value ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ('');
                }}
              >
                <span className="ob-type-ico" aria-hidden>{STORE_CATEGORY_EMOJI[c]}</span>
                <strong>{STORE_CATEGORY_LABELS[c]}</strong>
                <span className="ob-type-hint">{HINTS[c]}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="hint" style={{ margin: 0 }}>
                Nothing matches “{q}” — General is the closest fit.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
