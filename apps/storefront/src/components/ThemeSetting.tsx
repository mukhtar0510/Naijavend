'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Light/dark picker for the settings pages (seller studio + customer profile).
 * Shares the `sf-theme` localStorage key and `data-theme` attribute with the
 * no-FOUC script in app/layout.tsx, so it stays in sync with anything else
 * that flips the theme.
 */
export function ThemeSetting() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('sf-theme', next);
    } catch {
      // Private mode — the choice just won't persist.
    }
  }

  // Until we've read the applied theme we render both options unpressed
  // rather than briefly highlighting the wrong one.
  const current = mounted ? theme : null;

  return (
    <div className="theme-setting" role="radiogroup" aria-label="Colour theme">
      <button
        type="button"
        role="radio"
        aria-checked={current === 'light'}
        className={`theme-setting-opt${current === 'light' ? ' is-on' : ''}`}
        onClick={() => apply('light')}
      >
        <span className="theme-setting-ico" aria-hidden>☀️</span>
        <span className="theme-setting-copy">
          <strong>Light</strong>
          <span>Bright surfaces, dark text — the default.</span>
        </span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={current === 'dark'}
        className={`theme-setting-opt${current === 'dark' ? ' is-on' : ''}`}
        onClick={() => apply('dark')}
      >
        <span className="theme-setting-ico" aria-hidden>🌙</span>
        <span className="theme-setting-copy">
          <strong>Dark</strong>
          <span>Dimmed surfaces for night-time use.</span>
        </span>
      </button>
    </div>
  );
}
