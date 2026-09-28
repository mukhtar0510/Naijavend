'use client';

import { useState } from 'react';
import { WhatsAppIcon, XIcon, FacebookIcon, TelegramIcon, LinkIcon, ShareIcon, CheckIcon } from '@/components/SocialIcons';
import { StoreQrCode } from '@/components/StoreQrCode';

const TARGETS = [
  { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon },
  { key: 'x', label: 'X (Twitter)', Icon: XIcon },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { key: 'telegram', label: 'Telegram', Icon: TelegramIcon },
] as const;

function track(storeId: string, eventType: 'share' | 'link_copy', source?: string) {
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId,
      eventType,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      source,
    }),
  }).catch(() => undefined);
}

// Share row for store sites: social targets + copy-link, all events tracked.
export function ShareBar({
  storeId,
  storeName,
  url,
  accent = null,
  logoUrl = null,
}: {
  storeId: string;
  storeName: string;
  url: string;
  accent?: string | null;
  logoUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Check out ${storeName} on Naijavend`;

  async function share(target: (typeof TARGETS)[number]['key']) {
    track(storeId, 'share', target);
    const encoded = encodeURIComponent(url);
    const message = encodeURIComponent(`${text} ${url}`);
    const links: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${message}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encoded}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      telegram: `https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(text)}`,
    };
    window.open(links[target], '_blank', 'noopener,noreferrer');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    track(storeId, 'link_copy');
    setTimeout(() => setCopied(false), 2000);
  }

  // Native share on phones when available.
  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, text, url });
        track(storeId, 'share', 'native');
        return;
      } catch {
        // user cancelled — fall through to buttons
      }
    }
  }

  const hasNative = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="share-bar" aria-label={`Share ${storeName}`}>
      <span className="muted" style={{ fontSize: 13.5 }}>Share this store:</span>
      {hasNative && (
        <button type="button" className="share-btn" onClick={nativeShare} aria-label="Share">
          <ShareIcon size={14} /> Share
        </button>
      )}
      {TARGETS.map(({ key, label, Icon }) => (
        <button key={key} type="button" className="share-btn" onClick={() => share(key)} aria-label={`Share on ${label}`}>
          <Icon size={14} /> {label}
        </button>
      ))}
      <button type="button" className="share-btn" onClick={copy} aria-label="Copy store link">
        {copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />} {copied ? 'Copied!' : 'Copy link'}
      </button>
      <StoreQrCode url={url} storeName={storeName} accent={accent} logoUrl={logoUrl} variant="sharebar" />
    </div>
  );
}
