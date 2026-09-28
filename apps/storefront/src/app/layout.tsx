import type { Metadata, Viewport } from 'next';
// Design system split into modules — imported once at the root, in cascade order:
// tokens/base → chrome (headers/footers) → components (forms/cards) → interactions (responsive + dark).
import '../styles/base.css';
import '../styles/chrome.css';
import '../styles/components.css';
import '../styles/interactions.css';
import '../styles/admin.css';
import '../styles/mobile.css';
import '../styles/locations-lightbox.css';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: {
    default: 'Naijavend — discover local Nigerian stores & services',
    template: '%s · Naijavend',
  },
  description:
    'Naijavend — discover trusted Nigerian stores and services with real storefront websites, a street-level map, verified blue ticks, chat, bookings and honest reviews. Order on WhatsApp and shop local.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'Naijavend', statusBarStyle: 'default' },
};

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Fonts: preconnect + parallel stylesheet (replaces render-blocking @import).
            display=swap keeps text visible while webfonts arrive. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Supabase REST + storage: every page queries these — warm the connection early. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&family=Manrope:wght@400;600;700;800&family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Urbanist:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Merriweather:wght@400;700;900&family=Lora:ital,wght@0,400;0,600;0,700;1,600&family=Libre+Baskerville:wght@400;700&family=Fraunces:ital,wght@0,500;0,700;0,900;1,600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Bricolage+Grotesque:wght@400;600;700;800&family=Bebas+Neue&family=Unbounded:wght@400;600;700;800&family=Oswald:wght@400;500;600;700&family=Dancing+Script:wght@500;600;700&family=Pacifico&family=Great+Vibes&family=Satisfy&family=Caveat:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
