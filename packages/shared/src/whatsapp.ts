// WhatsApp click-to-chat link builder (blueprint §4: whatsapp-link-builder).
// Not a bot — a pre-filled wa.me deep link with store/listing context baked in.

export interface WhatsAppLinkInput {
  businessNumber: string;
  storeName: string;
  listingTitle?: string;
  priceNaira?: number;
}

export function buildWhatsAppLink(input: WhatsAppLinkInput): string {
  const digits = input.businessNumber.replace(/[^0-9]/g, '');
  if (!digits) return '';

  const parts: string[] = [`Hello ${input.storeName}!`];
  if (input.listingTitle) {
    parts.push(`I'm interested in "${input.listingTitle}"`);
    if (typeof input.priceNaira === 'number') {
      parts.push(`listed at ₦${input.priceNaira.toLocaleString('en-NG')}`);
    }
  }
  parts.push('Is it available?');

  const message = parts.join(' ');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}
