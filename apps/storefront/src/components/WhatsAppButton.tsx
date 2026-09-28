import { buildWhatsAppLink } from '@idevtenancy/shared';

export function WhatsAppButton({
  businessNumber,
  storeName,
  listingTitle,
  priceNaira,
  label = 'Chat on WhatsApp',
  className = 'btn btn-whatsapp',
}: {
  businessNumber: string;
  storeName: string;
  listingTitle?: string;
  priceNaira?: number;
  label?: string;
  className?: string;
}) {
  const href = buildWhatsAppLink({ businessNumber, storeName, listingTitle, priceNaira });
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
