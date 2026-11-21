/** @type {import('tailwindcss').Config} */
//
// shadcn/ui layer for the Kwaravend storefront.
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
    // `.container` is Kwaravend's own 1080px layout class; Tailwind's utility
    // of the same name would silently override it app-wide.
    container: false,
  },
  theme: {
    container: { center: true },
    extend: {
      // REDESIGN_V2 §0.1 shadcn mapping. Our tokens (styles/tokens.css) are the
      // source; gold and green are custom colours, never shadcn's "accent".
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--primary)',
        background: 'var(--bg-0)',
        foreground: 'var(--text)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--on-primary)' },
        secondary: { DEFAULT: 'var(--surface-raised)', foreground: 'var(--text)' },
        destructive: { DEFAULT: 'var(--danger)', foreground: 'var(--on-danger)' },
        success: { DEFAULT: 'var(--green)', foreground: 'var(--on-green)' },
        muted: { DEFAULT: 'var(--bg-1)', foreground: 'var(--text-muted)' },
        accent: { DEFAULT: 'var(--surface-raised)', foreground: 'var(--text)' },
        popover: { DEFAULT: 'var(--surface-raised)', foreground: 'var(--text)' },
        card: { DEFAULT: 'var(--surface)', foreground: 'var(--text)' },
        gold: { DEFAULT: 'var(--gold)', fill: 'var(--gold-fill)', foreground: 'var(--on-gold)' },
        green: { DEFAULT: 'var(--green)', foreground: 'var(--on-green)' },
        warning: 'var(--warning)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--bg-1)',
          foreground: 'var(--text)',
          primary: 'var(--primary)',
          'primary-foreground': 'var(--on-primary)',
          border: 'var(--border)',
          ring: 'var(--primary)',
        },
      },
      borderRadius: {
        lg: 'var(--radius-md)',
        md: 'var(--radius-sm)',
        sm: 'var(--radius-xs)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
        e4: 'var(--e4)',
        e5: 'var(--e5)',
      },
      backgroundImage: {
        'grad-brand': 'var(--grad-brand)',
        'grad-gold': 'var(--grad-gold)',
        'grad-skyline': 'var(--grad-skyline)',
      },
    },
  },
  plugins: [],
};
