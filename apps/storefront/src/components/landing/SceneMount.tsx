'use client';

// Loads the landing scene after first paint as its own lazy chunk, so the
// hero text (real HTML) is always the first thing painted (REDESIGN 4.7).
import dynamic from 'next/dynamic';

export const SceneMount = dynamic(() => import('./scene/LandingScene').then((m) => m.LandingScene), {
  ssr: false,
  loading: () => <div className="sc tier-lite" aria-hidden><div className="sc-layer" style={{ inset: 0 }}><div className="sc-fill sc-sky" /></div></div>,
});

export const ReduceEffectsMount = dynamic(() => import('./scene/LandingScene').then((m) => m.ReduceEffectsToggle), {
  ssr: false,
});
