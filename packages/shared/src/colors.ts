const HEX = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(background: string, text?: string): boolean {
  if (!HEX.test(background)) return false;
  if (text === undefined) return true;
  if (!HEX.test(text)) return false;
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const L1 = lum(background);
  const L2 = lum(text);
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return ratio >= 3; // large-text / UI-component floor from WCAG
}
