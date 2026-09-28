import type { BusinessHours } from '@idevtenancy/shared';
import { isOpenNow } from '@/lib/hours';

/**
 * Live "Open now / Closed" chip in the store masthead. Hidden entirely when the
 * seller hasn't configured business hours, so stores never show a wrong guess.
 */
export function OpenBadge({ hours }: { hours: BusinessHours | null | undefined }) {
  const open = isOpenNow(hours);
  if (open === null) return null;
  return (
    <span className={`open-badge ${open ? 'open-badge-open' : 'open-badge-closed'}`}>
      <span aria-hidden className="open-badge-dot" />
      {open ? 'Open now' : 'Closed'}
    </span>
  );
}
