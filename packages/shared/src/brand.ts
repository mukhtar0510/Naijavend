// Naijavend brand tokens.
// Used by the Next.js storefront CSS variables and the Expo theme.

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
