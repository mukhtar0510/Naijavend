import type { BusinessHours } from './types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function rangeFor(hours: BusinessHours | null | undefined, now: Date): [string, string] | null | undefined {
  if (!hours) return undefined;
  return hours[DAY_KEYS[now.getDay()]];
}

/**
 * Is the store open right now? Evaluated against the viewer's local clock —
 * stores are local businesses and their hours are wall-clock times.
 */
export function isOpenNow(hours: BusinessHours | null | undefined, now: Date = new Date()): boolean {
  const range = rangeFor(hours, now);
  if (!range) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(range[0]) && mins <= toMinutes(range[1]);
}

/** Today's window as "09:00–18:00", or null when closed all day / unknown. */
export function todayHoursLabel(hours: BusinessHours | null | undefined, now: Date = new Date()): string | null {
  const range = rangeFor(hours, now);
  return range ? `${range[0]}–${range[1]}` : null;
}
