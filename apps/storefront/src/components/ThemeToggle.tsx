'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Dark-mode toggle for the marketplace header. Writes `data-theme` on <html>
 * and persists the choice; respects the OS preference until the user picks.
 * (The no-FOUC inline script in app/layout.tsx applies the saved theme pre-render.)
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('sf-theme', next);
    } catch {
      // Private mode — theme just won't persist.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {/* Inline glyphs: no icon font, no layout shift on hydration. */}
      <span className="theme-toggle-track" aria-hidden>
        <span className="theme-toggle-thumb">{mounted ? (theme === 'dark' ? '🌙' : '☀️') : '🌗'}</span>
      </span>
    </button>
  );
}
