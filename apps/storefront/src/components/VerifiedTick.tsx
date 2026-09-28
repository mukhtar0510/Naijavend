// The Naijavend blue tick — shown next to verified store names.
// Verification rule: 30+ reviews averaging 4.0+ stars (see /api/verification/apply).
export function VerifiedTick({ size = 16 }: { size?: number }) {
  return (
    <span
      className="vtick"
      title="Verified store — 30+ reviews averaging 4 stars or more"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Verified store"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          fill="#1d9bf0"
          d="M12 1.5l2.7 2.1 3.4-.4 1.2 3.2 3 1.7-1 3.3 1 3.3-3 1.7-1.2 3.2-3.4-.4L12 22.5l-2.7-2.1-3.4.4-1.2-3.2-3-1.7 1-3.3-1-3.3 3-1.7L5.9 3.2l3.4.4L12 1.5z"
        />
        <path
          fill="#fff"
          d="M10.6 15.7l-2.8-2.8 1.3-1.3 1.5 1.5 4.3-4.3 1.3 1.3-5.6 5.6z"
        />
      </svg>
    </span>
  );
}
