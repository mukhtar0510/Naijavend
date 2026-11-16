'use client';

// Trade filter for /discover.
//
// The list is long (14+ trades), so it stays a one-row rail on phones. On
// desktop the overflow chips are hidden and a "More categories" popover owns
// them — no sideways scrolling with a mouse wheel and no second wrapped row
// pushing the store grid down.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { STORE_CATEGORIES, categoryEmoji, categoryLabel } from '@idevtenancy/shared';

const INLINE_COUNT = 5;

export function DiscoverCategories({
  current,
  q,
  openOnly,
}: {
  current?: string;
  q: string;
  openOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function hrefFor(category?: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    if (openOnly) params.set('open', '1');
    const suffix = params.toString();
    return `/discover${suffix ? `?${suffix}` : ''}`;
  }

  // Clicking "Open now" while active clears the filter, same as before.
  function openNowHref() {
    const params = new URLSearchParams();
    if (current) params.set('category', current);
    if (q) params.set('q', q);
    if (!openOnly) params.set('open', '1');
    const suffix = params.toString();
    return `/discover${suffix ? `?${suffix}` : ''}`;
  }

  return (
    <div className="cat-filter">
      <div className="brand-chip-row">
        <Link href={hrefFor()} className={`brand-chip no-underline ${!current && !openOnly ? 'is-active' : ''}`}>
          All stores
        </Link>
        <Link href={openNowHref()} className={`brand-chip no-underline ${openOnly ? 'is-active' : ''}`}>
          <span aria-hidden>🟢</span> Open now
        </Link>
        {STORE_CATEGORIES.map((c, i) => (
          <Link
            key={c}
            href={hrefFor(c)}
            className={`brand-chip no-underline${i >= INLINE_COUNT ? ' cat-extra' : ''} ${current === c ? 'is-active' : ''}`}
          >
            <span aria-hidden>{categoryEmoji(c)}</span> {categoryLabel(c)}
          </Link>
        ))}
      </div>

      <div className="cat-more" ref={wrapRef}>
        <button
          type="button"
          className="brand-chip cat-more-btn"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          More categories <ChevronDown size={14} aria-hidden />
        </button>
        {open && (
          <div className="cat-more-panel" role="menu" aria-label="All store categories">
            {STORE_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={hrefFor(c)}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`cat-more-item${current === c ? ' is-active' : ''}`}
              >
                <span aria-hidden>{categoryEmoji(c)}</span>
                {categoryLabel(c)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
