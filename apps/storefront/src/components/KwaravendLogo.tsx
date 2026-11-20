// Kwaravend app logo — flat 2D mark: a stylised "K" built from a market-stall
// awning and counter, on a rounded tile. Pure inline SVG (no image file needed)
// and theme-aware via CSS variables. The `KwaravendLogoMark` is the icon alone;
// `KwaravendWordmark` pairs it with the text logo used in headers.
import { BRAND } from '@idevtenancy/shared';

export function KwaravendLogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${BRAND.name} logo`}
      className="nv-logo"
    >
      <defs>
        <clipPath id="kv-tile">
          <rect x="2" y="2" width="60" height="60" rx="16" />
        </clipPath>
      </defs>
      {/* Tile background */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--blue, #1D4ED8)" />
      <g clipPath="url(#kv-tile)">
        {/* Sun disc — top right, market-morning feel */}
        <circle cx="47" cy="15" r="7" fill="#FFC83D" />
        {/* The letter K: a post with two strokes meeting at the middle */}
        <rect x="16" y="17" width="7" height="31" rx="2.5" fill="#FFFFFF" />
        {/* Upper arm doubles as the striped awning */}
        <g transform="rotate(-38 31 26)">
          <rect x="20" y="22" width="26" height="9" rx="4" fill="#FFFFFF" />
          <rect x="25" y="22" width="6" height="9" fill="var(--nv-accent, #BE1E6B)" />
          <rect x="37" y="22" width="6" height="9" fill="var(--nv-accent, #BE1E6B)" />
        </g>
        {/* Lower leg */}
        <path
          d="M23 30 L44 49"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        {/* Counter / stall base */}
        <rect x="18" y="44" width="26" height="4.5" rx="2.25" fill="#FFFFFF" opacity="0.85" />
      </g>
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
