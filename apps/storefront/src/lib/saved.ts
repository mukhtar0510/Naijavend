// Saved stores — local-first favourites. Stored in this browser only (no
// account needed); components stay in sync via a custom window event.
const KEY = 'sf-saved';
export const SAVED_EVENT = 'sf-saved-changed';
const MAX_SAVED = 100;

export function getSavedSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isSaved(slug: string): boolean {
  return getSavedSlugs().includes(slug);
}

/** Toggle a store; returns the new saved state. */
export function toggleSaved(slug: string): boolean {
  const current = getSavedSlugs();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug].slice(-MAX_SAVED);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full/blocked — state still flips for this session.
  }
  window.dispatchEvent(new Event(SAVED_EVENT));
  return next.includes(slug);
}
