'use client';

import { useEffect, useState } from 'react';

/**
 * iOS in-app browsers (opening a link from WhatsApp, Instagram, X, Facebook…)
 * run the site in a locked-down WebView: cookies are isolated or blocked and
 * Google refuses OAuth there ("this browser isn't secure"), so sign-in
 * silently fails. Android in-app browsers share Chrome's cookie jar, which is
 * why the same link "just works" on Android — this banner explains the fix
 * instead of leaving the user stuck.
 */
const IOS_DEVICE = /iP(hone|ad|od)/;
const IOS_STANDALONE = /Safari\//;          // real Safari, Chrome (CriOS), Firefox (FxiOS)…
const KNOWN_IN_APP = /FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Twitter|X\/|LinkedInApp|Snapchat|Pinterest|WebView|HeyNaija/i;

export function InAppBrowserWarning() {
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const knownApp = KNOWN_IN_APP.test(ua);
    const iosInApp = IOS_DEVICE.test(ua) && !IOS_STANDALONE.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    setInApp(knownApp || iosInApp);
  }, []);

  if (!inApp) return null;

  return (
    <div className="alert alert-error" role="alert" style={{ marginBottom: 14 }}>
      <strong>Open this page in Safari.</strong> You&apos;re viewing it inside another app
      (WhatsApp, Instagram, X…), and those built-in browsers block sign-in. Tap the
      share icon <span aria-hidden>⬆️</span> and choose <em>Open in Safari</em>, then sign in there.
    </div>
  );
}
