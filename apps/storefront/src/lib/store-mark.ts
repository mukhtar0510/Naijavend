// A store's own mark for maps and lists when it has no uploaded logo: its
// initials on its theme colour. More recognisable than a trade icon, which
// every store in the same trade shares.

const SKIP = new Set(['the', 'and', 'of', '&', 'ltd', 'limited', 'enterprise', 'enterprises', 'nig', 'nigeria']);

/** "Tanke Braids & Hair" → "TB"; "Kwarafoods" → "KW". */
export function storeInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return (name.trim()[0] ?? '?').toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Background and a readable text colour (black or white, by WCAG luminance). */
export function markColors(color: string | null | undefined, fallback = '#1D4ED8'): { bg: string; fg: string } {
  const bg = color && hexRgb(color) ? color : fallback;
  const rgb = hexRgb(bg) ?? [29, 78, 216];
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  // Contrast against white vs black; pick the stronger.
  const fg = (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#FFFFFF' : '#0B0C0F';
  return { bg, fg };
}

// Stores that never picked a theme colour still get a distinct, steady colour
// (from their slug), so neighbouring pins don't all look alike.
const PALETTE = ['#1D4ED8', '#7C3AED', '#BE185D', '#B45309', '#047857', '#0E7490', '#B91C1C', '#4338CA', '#9D174D', '#15803D'];

export function storeMark(name: string, slug: string, accent: string | null | undefined) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { initials: storeInitials(name), ...markColors(accent, PALETTE[h % PALETTE.length]) };
}
