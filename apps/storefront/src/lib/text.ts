// Multi-line plain text from a form (support tickets, replies). Keeps line
// breaks, strips control characters, trims and caps the length. Rendered by
// React as text, never as HTML.
export function sanitizeMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}
