/** @type {import('tailwindcss').Config} */
//
// shadcn/ui layer for the Naijavend storefront.
//
// The app has its own long-standing design system (src/styles/*.css) driven by
// CSS custom properties — including the per-store `store_themes` colours. This
// config does NOT replace it: every shadcn token is mapped onto those existing
// variables, so the ui/* components and the store pages always share one
// palette (and dark mode keeps working off [data-theme='dark']).
//
// Preflight is disabled on purpose — Tailwind's global reset would undo the
// typography and form defaults the rest of the app depends on.
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  corePlugins: {
    preflight: false,
    // `.container` is Naijavend's own 1080px layout class; Tailwind's utility
    // of the same name would silently override it app-wide.
    container: false,
  },
  theme: {
    container: { center: true },
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--blue)',
        background: 'var(--bg)',
        foreground: 'var(--text)',
        primary: { DEFAULT: 'var(--blue)', foreground: '#ffffff' },
        secondary: { DEFAULT: 'var(--elevated)', foreground: 'var(--text)' },
        destructive: { DEFAULT: 'var(--danger)', foreground: '#ffffff' },
        success: { DEFAULT: 'var(--success)', foreground: '#ffffff' },
        muted: { DEFAULT: 'var(--elevated)', foreground: 'var(--text-muted)' },
        accent: { DEFAULT: 'var(--blue-tint)', foreground: 'var(--text)' },
        popover: { DEFAULT: 'var(--surface)', foreground: 'var(--text)' },
        card: { DEFAULT: 'var(--surface)', foreground: 'var(--text)' },
      },
      borderRadius: {
        lg: 'var(--radius-md)',
        md: 'var(--radius-sm)',
        sm: 'var(--radius-xs)',
      },
      fontFamily: {
        heading: ['Sora', 'Inter', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
