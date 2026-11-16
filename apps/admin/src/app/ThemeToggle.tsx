'use client';

import { useEffect, useState } from 'react';

/**
 * Light/dark switch for the admin shell.
 *
 * The theme lives on <html data-theme> (set before paint by the script in
 * layout.tsx) and is persisted in localStorage as `ac-theme`. `mounted` keeps
 * the server markup (always light) from flashing the wrong icon.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem('ac-theme', next);
    } catch {
      // Private mode — theme just won't persist.
    }
  }

  const dark = mounted && theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle-compact"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {!mounted ? (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : dark ? (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 3v2.1M12 18.9V21M21 12h-2.1M5.1 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 13.2A8.1 8.1 0 0 1 10.8 3.5a8.1 8.1 0 1 0 9.7 9.7Z" />
        </svg>
      )}
    </button>
  );
}
