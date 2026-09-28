// Naijavend app logo — flat 2D mark: a stylised "N" whose diagonal is a market
// stall awning, on a rounded tile. Pure inline SVG (no image file needed) and
// theme-aware via CSS variables. The `NaijavendLogoMark` is the icon alone;
// `NaijavendWordmark` pairs it with the text logo used in headers.
export function NaijavendLogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Naijavend logo"
      className="nv-logo"
    >
      <defs>
        <clipPath id="nv-tile">
          <rect x="2" y="2" width="60" height="60" rx="16" />
        </clipPath>
      </defs>
      {/* Tile background */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--blue, #1D4ED8)" />
      <g clipPath="url(#nv-tile)">
        {/* Sun disc — top right, market-morning feel */}
        <circle cx="47" cy="15" r="7" fill="#FFC83D" />
        {/* The letter N: two posts + striped awning as the diagonal */}
        <rect x="14" y="18" width="7" height="30" rx="2.5" fill="#FFFFFF" />
        <rect x="41" y="18" width="7" height="30" rx="2.5" fill="#FFFFFF" />
        {/* Awning stripes along the N diagonal */}
        <g transform="rotate(-42 31 24)">
          <rect x="12" y="18" width="38" height="9" rx="4" fill="#FFFFFF" />
          <rect x="17" y="18" width="7" height="9" fill="var(--nv-accent, #BE1E6B)" />
          <rect x="31" y="18" width="7" height="9" fill="var(--nv-accent, #BE1E6B)" />
          <rect x="45" y="18" width="5" height="9" fill="var(--nv-accent, #BE1E6B)" />
        </g>
        {/* Counter / stall base */}
        <rect x="18" y="44" width="26" height="4.5" rx="2.25" fill="#FFFFFF" opacity="0.85" />
      </g>
    </svg>
  );
}

/** Icon + wordmark lockup for headers and the about page hero. */
export function NaijavendWordmark({ size = 34, tagline }: { size?: number; tagline?: string }) {
  return (
    <span className="nv-wordmark">
      <NaijavendLogoMark size={size} />
      <span className="nv-wordmark-text">
        <span className="nv-wordmark-name">
          Naija<span>vend</span>
        </span>
        {tagline && <span className="nv-wordmark-tagline">{tagline}</span>}
      </span>
    </span>
  );
}
