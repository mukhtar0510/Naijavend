'use client';

// Area selector (REDESIGN_V2 §4.1; owner, 21 Nov 2026: "a simple dropdown").
// A native <select> styled as a pill with a pin icon: "All of Ilorin",
// "Use my location", then every seeded Ilorin area A–Z. The choice is
// remembered in this browser only (try/catch storage). With "Use my location"
// the coordinates never leave the browser — we only keep the nearest area id.

import * as React from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { ILORIN_AREAS_SORTED, inIlorin, nearestArea } from '@/lib/ilorin';

const KEY = 'kv-area';
export const AREA_EVENT = 'kv-area-change';
const LOCATE = '__locate';

export function readArea(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function useArea(): [string | null, (id: string | null) => void] {
  const [area, setArea] = React.useState<string | null>(null);
  React.useEffect(() => {
    setArea(readArea());
    const on = () => setArea(readArea());
    window.addEventListener(AREA_EVENT, on);
    return () => window.removeEventListener(AREA_EVENT, on);
  }, []);
  const set = React.useCallback((id: string | null) => {
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
    setArea(id);
    window.dispatchEvent(new Event(AREA_EVENT));
  }, []);
  return [area, set];
}

export function AreaSelector({
  onChange,
  label = 'Your area in Ilorin',
  className,
}: {
  onChange?: (id: string | null) => void;
  /** Accessible name for the dropdown. */
  label?: string;
  className?: string;
}) {
  const [area, setArea] = useArea();
  const [locating, setLocating] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const id = React.useId();

  function choose(next: string | null) {
    setArea(next);
    setNote(null);
    onChange?.(next);
  }

  function locate() {
    if (!('geolocation' in navigator)) return setNote('Location is not available here. Pick an area.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!inIlorin(latitude, longitude)) {
          setNote('Kwaravend is only in Ilorin for now. Pick an Ilorin area.');
          return;
        }
        choose(nearestArea(latitude, longitude).id);
      },
      () => {
        setLocating(false);
        setNote('Location is off. Pick an area.');
      },
      { maximumAge: 300000, timeout: 8000 },
    );
  }

  return (
    <div className={className ? `kv-area ${className}` : 'kv-area'}>
      <label htmlFor={id} className="kv-area-pill">
        <MapPin size={16} aria-hidden className="kv-area-pin" />
        <span className="sr-only">{label}</span>
        <select
          id={id}
          className="kv-area-select"
          value={locating ? LOCATE : (area ?? '')}
          onChange={(e) => {
            const v = e.target.value;
            if (v === LOCATE) locate();
            else choose(v || null);
          }}
        >
          <option value="">All of Ilorin</option>
          <option value={LOCATE}>{locating ? 'Finding your area…' : 'Use my location'}</option>
          <optgroup label="Areas">
            {ILORIN_AREAS_SORTED.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown size={15} aria-hidden className="kv-area-chev" />
      </label>
      {note && (
        <p className="kv-area-note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
