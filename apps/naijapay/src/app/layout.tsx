import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import '@/styles/wallet.css';
import { WalletProvider } from '@/lib/wallet';
import { AppChrome } from '@/components/AppChrome';

export const metadata: Metadata = {
  title: 'NaijaPay — Wallet for Naijavend',
  description: 'Demo wallet for paying Naijavend stores: top up, pay, save.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8',
};

// Pre-paint theme: same pattern as the Naijavend marketplace toggle.
const themeScript = `(function(){try{var t=localStorage.getItem('naijapay_theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: import('react').ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <WalletProvider>
          <AppChrome>{children}</AppChrome>
        </WalletProvider>
      </body>
    </html>
  );
}
