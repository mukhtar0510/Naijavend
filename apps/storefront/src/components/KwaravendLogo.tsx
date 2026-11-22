// Kwaravend logo (23 Nov 2026): a gold tile with a market-stall awning across
// the top and a bold K underneath — a shop, in Kwara. Same drawing as
// public/logo.svg and the PNG app icons in public/icons. Fixed colours so it
// reads the same in light and dark mode (the gold rim keeps the awning edge
// visible on near-black backgrounds).
import { BRAND } from '@idevtenancy/shared';

export function KwaravendLogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${BRAND.name} logo`} className="nv-logo">
      <defs>
        <linearGradient id="kvlg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC21A" />
          <stop offset="1" stopColor="#E08F00" />
        </linearGradient>
        <clipPath id="kvlg-inner">
          <rect x="4.5" y="4.5" width="55" height="55" rx="13.5" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#kvlg-gold)" />
      <g clipPath="url(#kvlg-inner)">
        {/* Market-stall awning: alternating stripes, scalloped edge */}
        <path d="M2 2H62V13a6 6 0 0 1-12 0a6 6 0 0 1-12 0a6 6 0 0 1-12 0a6 6 0 0 1-12 0a6 6 0 0 1-12 0Z" fill="#0B0B0E" />
        <path d="M14 2h12v11a6 6 0 0 1-12 0Z M38 2h12v11a6 6 0 0 1-12 0Z" fill="#FFF6DC" />
      </g>
      {/* The K */}
      <rect x="17" y="24" width="8.5" height="29" rx="3" fill="#0B0B0E" />
      <path d="M26 39L43 25" stroke="#0B0B0E" strokeWidth="8.5" strokeLinecap="round" fill="none" />
      <path d="M30 37L44 51" stroke="#0B0B0E" strokeWidth="8.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Icon + wordmark lockup for headers and the about page hero. */
export function KwaravendWordmark({ size = 34, tagline }: { size?: number; tagline?: string }) {
  return (
    <span className="nv-wordmark">
      <KwaravendLogoMark size={size} />
      <span className="nv-wordmark-text">
        <span className="nv-wordmark-name">
          {BRAND.wordmark.first}
          <span>{BRAND.wordmark.second}</span>
        </span>
        {tagline && <span className="nv-wordmark-tagline">{tagline}</span>}
      </span>
    </span>
  );
}
