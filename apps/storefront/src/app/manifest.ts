import type { MetadataRoute } from 'next';

// PWA manifest: makes Naijavend installable on Android/Chrome (and via browser
// "Add to Home Screen" elsewhere). Icons are static files under /icons.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Naijavend — storefronts for Nigerian sellers',
    short_name: 'Naijavend',
    description:
      'Discover trusted local Nigerian stores and services. Browse catalogues, order, book appointments, chat with sellers and rate real businesses.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#1D4ED8',
    categories: ['shopping', 'business', 'food'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Discover stores',
        short_name: 'Discover',
        url: '/discover',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Search',
        short_name: 'Search',
        url: '/search',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
