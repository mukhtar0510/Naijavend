'use client';

import { useEffect, useState } from 'react';

// Registers /sw.js (offline mode) in PRODUCTION and surfaces the browser's
// install prompt as a small floating button when the app is installable.
//
// Dev machines must never run the SW: cached HTML references hashed chunks
// that stop existing after every rebuild, so client-side navigations fail and
// Next.js falls back to the not-found page. When we detect a leftover SW in
// dev we unregister it and clear every cache — that heals browsers that were
// stuck seeing 404s from a previous session.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Heal any stale SW/cache state from a previous dev session.
      navigator.serviceWorker?.getRegistrations?.().then((regs) => {
        regs.forEach((r) => void r.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k))).catch(() => {});
      }
      return;
    }

    if ('serviceWorker' in navigator) {
      const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!installEvent || hidden) return null;

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setHidden(true);
  };

  return (
    <button
      type="button"
      className="pwa-install-btn"
      onClick={install}
      title="Install Naijavend on this device"
      aria-label="Install Naijavend app"
    >
      ⬇ Install app
    </button>
  );
}
