// Button shape for the AI theme designer (22 Nov 2026). Stores already support
// pill / rounded / square (stores_theme.button_shape); "flat" in a brief means
// square corners. Explicit words in the brief always win, then the vibe, then
// the layout's natural default.

export type ButtonShape = 'pill' | 'rounded' | 'square';
export const BUTTON_SHAPES: readonly ButtonShape[] = ['pill', 'rounded', 'square'];

export function isButtonShape(v: unknown): v is ButtonShape {
  return typeof v === 'string' && (BUTTON_SHAPES as readonly string[]).includes(v);
}

/** Shape the seller asked for in so many words, or null. */
export function explicitButtonShape(brief: string): ButtonShape | null {
  const t = brief.toLowerCase();
  if (/\b(flat|square|squared|sharp|boxy|straight[- ]edged?|no round(ed|ing)?)\b/.test(t)) return 'square';
  if (/\b(pill|pills|capsule|fully round(ed)?|very round(ed)?)\b/.test(t)) return 'pill';
  if (/\b(round|rounded|curved|soft corners?)\b/.test(t)) return 'rounded';
  return null;
}

const LAYOUT_DEFAULT: Record<string, ButtonShape> = {
  playful: 'pill',
  boutique: 'pill',
  bold: 'square',
  minimal: 'square',
  luxury: 'square',
  editorial: 'square',
};

/** Final pick: explicit words, then vibe words, then the layout default. */
export function buttonShapeFor(brief: string, layout: string, modelPick?: unknown): ButtonShape {
  const explicit = explicitButtonShape(brief);
  if (explicit) return explicit;
  if (isButtonShape(modelPick)) return modelPick;
  const t = brief.toLowerCase();
  if (/\b(playful|fun|cute|bubbly|kids?|bakery|cakes?|sweet|friendly)\b/.test(t)) return 'pill';
  if (/\b(minimal|corporate|tech|techy|brutal|editorial|architect|modern lines?)\b/.test(t)) return 'square';
  return LAYOUT_DEFAULT[layout] ?? 'rounded';
}
