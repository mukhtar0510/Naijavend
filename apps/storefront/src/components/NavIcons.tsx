// Inline SVG nav icons — consistent stroke weight, sized to the 16-18px
// optical grid. Stroke uses currentColor so they tint with the text color in
// both themes (no emoji rendering differences across devices).
import type { CSSProperties } from 'react';

type IconProps = { size?: number; style?: CSSProperties };

function base(size: number, style?: CSSProperties): CSSProperties {
  return { width: size, height: size, flexShrink: 0, ...style };
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconHome({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function IconStore({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.6 2.6 0 0 0 5.3 0 2.6 2.6 0 0 0 5.4 0 2.6 2.6 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8" />
      <path d="M10 20v-4.5h4V20" />
    </svg>
  );
}

export function IconCart({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M3.5 4.5h2l2.2 10.5h10.1l2.2-8H7" />
      <circle cx="9.3" cy="19" r="1.5" />
      <circle cx="16.6" cy="19" r="1.5" />
    </svg>
  );
}

export function IconCalendar({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

export function IconChat({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M20.5 11.7a7.7 7.7 0 0 1-8 7.3 8.6 8.6 0 0 1-3.2-.6L4 19.5l1.2-4.4a7 7 0 0 1-1.7-4.6 7.7 7.7 0 0 1 8-7.3 7.7 7.7 0 0 1 9 8.5Z" />
    </svg>
  );
}

export function IconUser({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

export function IconTag({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M12.6 3.5H20.5v7.9L11 20.9a2 2 0 0 1-2.8 0L3.1 15.8a2 2 0 0 1 0-2.8Z" />
      <circle cx="16" cy="8" r="1.3" />
    </svg>
  );
}

export function IconBox({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </svg>
  );
}

export function IconChart({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M4 4v16h16" />
      <path d="M8 16v-5M12.5 16V8M17 16v-3" />
    </svg>
  );
}

export function IconStar({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3l-4.8 2.6.9-5.4L4.2 9.7l5.4-.8Z" />
    </svg>
  );
}

export function IconGear({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </svg>
  );
}

export function IconTerminal({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7.5 9.5 3 2.5-3 2.5M13 15h4" />
    </svg>
  );
}

export function IconUsers({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5a6 6 0 0 1 12 0" />
      <path d="M15.5 5.7a3.2 3.2 0 0 1 0 5.6M17.5 13.9a6 6 0 0 1 3.5 5.6" />
    </svg>
  );
}

export function IconSpark({ size = 17, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, style)} aria-hidden {...S}>
      <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5Z" />
      <path d="M18.6 15.6l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z" />
    </svg>
  );
}
