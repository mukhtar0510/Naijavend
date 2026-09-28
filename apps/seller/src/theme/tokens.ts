import { brand, lightTheme } from '@idevtenancy/shared';

export const colors = brand.colors;
export const radius = brand.radius;

export const typography = {
  heading: { fontFamily: undefined, fontWeight: '700' as const, fontSize: 26 },
  title: { fontWeight: '600' as const, fontSize: 20 },
  body: { fontSize: 15 },
  small: { fontSize: 13, color: colors.textMuted },
  mono: { fontSize: 15 },
};

// Explicit light-theme aliases: white surfaces, blue accent.
export const light = lightTheme;

export const spacing = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;
