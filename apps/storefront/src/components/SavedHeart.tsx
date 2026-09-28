'use client';

import { useEffect, useState } from 'react';
import { isSaved, toggleSaved, SAVED_EVENT } from '@/lib/saved';

// Save/unsave a store. Local-first (this browser), no account required.
// Clicks are stopped from bubbling so hearts inside store-card links don't
// navigate. Syncs live with every other heart + the account page.
export function SavedHeart({ slug, name }: { slug: string; name: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isSaved(slug));
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [slug]);

  return (
    <button
      type="button"
      className={`saved-heart${saved ? ' on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved stores` : `Save ${name}`}
      title={saved ? 'Saved — tap to remove' : 'Save this store'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved(toggleSaved(slug));
      }}
    >
      {saved ? '♥' : '♡'}
    </button>
  );
}
