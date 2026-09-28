'use client';

import { useState } from 'react';
import { LinkIcon, CheckIcon } from '@/components/SocialIcons';

// Small copy-to-clipboard button styled like a share-bar chip, for server
// components that just need a one-tap link copy (e.g. product page share strip).

export function CopyLinkButton({ url, label = 'Copy link' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="share-btn" onClick={copy} aria-label={`Copy link: ${url}`}>
      {copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />} {copied ? 'Copied!' : label}
    </button>
  );
}
