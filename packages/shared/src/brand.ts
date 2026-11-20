// Kwaravend brand tokens.
// Used by the Next.js storefront CSS variables and the Expo theme.

/**
 * Product identity in one place. Anywhere the brand name, domain, order prefix
 * or launch city is shown, read it from here instead of hard-coding a string.
 *
 * `supportWhatsApp` and socials are intentionally empty until the owner
 * supplies real accounts — never invent a phone number.
 */
export const BRAND = {
  name: 'Kwaravend',
  /** Two-part wordmark split point: "Kwara" + "vend". */
  wordmark: { first: 'Kwara', second: 'vend' },
  tagline: 'Your business deserves more than a WhatsApp catalogue.',
  description:
    'Kwaravend gives Nigerian sellers a real storefront — catalogue, orders, delivery tracking and a map — starting in Ilorin, Kwara State.',
  domain: 'kwaravend.com',
  supportWhatsApp: '',
  supportEmail: '',
  socials: {
    instagram: '',
    facebook: '',
    x: '',
    tiktok: '',
  },
  /** Printed on order references, receipts and QR cards. Change in one place. */
  orderPrefix: 'KV-',
  /** The only region the product serves until the owner expands it. */
  launchRegion: {
    city: 'Ilorin',
    state: 'Kwara',
    country: 'Nigeria',
    countryCode: 'NG',
    centre: { lat: 8.4966, lng: 4.5421 },
  },
  /** Footer/legal label; legal text stays with the owner. */
  legalEntity: 'Kwaravend',
} as const;

/**
 * Short human-readable order reference, e.g. `KV-3F9A1C`.
 * Derived from the order UUID so no schema change is needed and the full id
 * stays available for API calls.
 */
export function orderRef(orderId: string): string {
  const compact = orderId.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  return `${BRAND.orderPrefix}${compact.slice(0, 6)}`;
}

/** `Kwaravend` or `Page · Kwaravend`, matching the Next.js title template. */
export function brandTitle(page?: string): string {
  return page ? `${page} · ${BRAND.name}` : BRAND.name;
}

/** Explicit light-theme surface tokens: white background, blue primary, black accents. */
export const lightTheme = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  elevated: '#F5F7FA',
  accent: '#1D4ED8',
  accentSoft: '#3B82F6',
} as const;

export const brand = {
  colors: {
    // Light theme: white surfaces with blue primary + black accents.
    blue: '#1D4ED8',
    blueSoft: '#3B82F6',
    black: '#0B0C0E',
    blackSurface: '#FFFFFF',
    blackElevated: '#F5F7FA',
    // Explicit light-theme aliases (preferred names; the black* names above are legacy).
    surface: '#FFFFFF',
    elevated: '#F5F7FA',
    text: '#0B0C0E',
    textMuted: '#5B6472',
    border: '#D8DEE7',
    success: '#15803D',
    danger: '#DC2626',
    warning: '#B45309',
    whatsapp: '#25D366',
  },
  fonts: {
    heading: 'Space Grotesk',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 16,
  },
} as const;
