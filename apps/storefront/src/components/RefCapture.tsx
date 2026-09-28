'use client';

import { useEffect } from 'react';

// Captures ?ref=<code> from a referral link into localStorage so the signup
// request can credit the referrer. 30-day attribution window. Renders nothing.
const KEY = 'sf-ref';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (!ref || !/^[A-Za-z0-9]{4,16}$/.test(ref)) return;
      window.localStorage.setItem(KEY, JSON.stringify({ code: ref, at: Date.now() }));
    } catch {
      // Storage unavailable — skip.
    }
  }, []);

  return null;
}

/** Reads the captured referral code, if fresh. */
export function takeReferralCode(): string | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { code?: string; at?: number } | null;
    if (!raw?.code || typeof raw.at !== 'number') return null;
    if (Date.now() - raw.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return /^[A-Za-z0-9]{4,16}$/.test(raw.code) ? raw.code : null;
  } catch {
    return null;
  }
}
