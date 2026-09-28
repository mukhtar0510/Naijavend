'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'vnd-cookie-consent';

// Minimal, honest consent banner: essential-only cookies, link to the policy,
// choice remembered in local storage. Renders nothing once answered.
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // storage unavailable — don't nag
    }
  }, []);

  function answer(value: 'accepted' | 'essential') {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <p>
        We use essential cookies to keep you signed in and anonymous session storage to count store visits —
        no ads, no trackers. See our{' '}
        <Link href="/legal/cookies">Cookies Policy</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => answer('accepted')}>
          OK
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => answer('essential')}>
          Essential only
        </button>
      </div>
    </div>
  );
}
