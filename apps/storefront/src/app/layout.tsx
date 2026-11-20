import type { Metadata, Viewport } from 'next';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
// Design system split into modules — imported once at the root, in cascade order:
// tokens/base → chrome (headers/footers) → components (forms/cards) → interactions (responsive + dark).
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/chrome.css';
import '../styles/components.css';
import '../styles/interactions.css';
import '../styles/mobile.css';
// Brand experience layer (About / FAQ): gradient canvases, isometric stacks, mockups.
import '../styles/brand.css';
// Marketplace refresh (header, home, map, buyer account) is imported by the
// (marketplace) and (buyer-auth) layouts so the landing page does not ship it.
// Tailwind utilities for the shadcn/ui components (src/components/ui) — imported
// last so component utilities win ties against the hand-written design system.
import '../styles/tailwind.css';
import { BRAND } from '@idevtenancy/shared';
import { PwaRegister } from '@/components/PwaRegister';
import { LanguageDock } from '@/components/LanguageDock';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — discover local stores in ${BRAND.launchRegion.city}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
};

// Self-hosted core fonts. Fetching fonts.googleapis.com cost ~2 s of
// render-blocking CSS on every page and caused the hero to reflow when the
// webfont landed; next/font inlines the @font-face rules and serves the files
// from our own origin with a metric-matched fallback.
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sora',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const viewport: Viewport = {
  themeColor: '#1D4ED8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Minimal root shell: fonts + metadata only. Each route group renders its own chrome —
// (marketplace) wraps public pages; /s/* store pages are independent sites.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No-FOUC theme: apply the saved (or OS) theme before first paint.
  const themeScript = `(function(){try{var t=localStorage.getItem('sf-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

  return (
    <html
      lang="en-NG"
      className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Fonts: only the three families the marketplace itself uses. The
            seller theme library (~21 families) lives in <ThemeFonts /> and is
            mounted only on store pages and the appearance editors — loading it
            here cost ~1.6 s of render-blocking CSS on every page. */}

        {/* Supabase REST + storage: every page queries these — warm the connection early. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
      </head>
      <body>
        {children}
        <PwaRegister />
        {/* Language + interface translation (EN / Pidgin / Yoruba / Hausa / Igbo). */}
        <LanguageDock />
      </body>
    </html>
  );
}
