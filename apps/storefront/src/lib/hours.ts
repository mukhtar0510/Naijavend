import type { BusinessHours } from '@idevtenancy/shared';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Is the store open right now? Returns null when the seller hasn't set hours,
 * so callers can hide the badge entirely instead of guessing.
 */
export function isOpenNow(hours: BusinessHours | null | undefined): boolean | null {
  if (!hours) return null;
  const now = new Date();
  const range = hours[DAY_KEYS[now.getDay()]];
  if (!range) return false;
  const [o, c] = range;
  const [oh, om] = o.split(':').map(Number);
  const [ch, cm] = c.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}

/** Human-readable per-day list for the store's contact section. */
export function formatHours(hours: BusinessHours | null | undefined): Array<{ day: string; text: string }> | null {
  if (!hours) return null;
  const labels: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  return order.map((d) => ({
    day: labels[d],
    text: hours[d] ? `${hours[d]![0]}–${hours[d]![1]}` : 'Closed',
  }));
}
