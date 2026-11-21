'use client';

// One switch for decorative motion (REDESIGN_V2 §0.1, §3.4): true when the
// visitor has the OS reduced-motion setting OR turned on "Reduce effects"
// (html.reduce-effects, remembered in localStorage 'nv-reduce-effects').
// Tilt, parallax, glow, loops and 3D all read this.

import * as React from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
export const REDUCE_EFFECTS_KEY = 'nv-reduce-effects';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.classList.contains('reduce-effects') ||
    window.matchMedia(QUERY).matches
  );
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => {
    mq.removeEventListener('change', onChange);
    mo.disconnect();
  };
}

export function useReduceEffects(): boolean {
  return React.useSyncExternalStore(subscribe, read, () => false);
}

/** Turn Reduce effects on or off for this browser (try/catch storage). */
export function setReduceEffects(on: boolean) {
  document.documentElement.classList.toggle('reduce-effects', on);
  try {
    window.localStorage.setItem(REDUCE_EFFECTS_KEY, on ? '1' : '0');
  } catch {
    /* private mode: still applies for this page view */
  }
  window.dispatchEvent(new Event('nv-reduce-effects'));
}

/** True on touch-first devices (no pointer tilt there). */
export function useCoarsePointer(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(pointer: coarse)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => true,
  );
}
