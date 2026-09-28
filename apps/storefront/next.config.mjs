/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@idevtenancy/shared', '@idevtenancy/ai'],
  // Leaner responses: no X-Powered-By, gzip on, strict mode for fewer double effects.
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // Hide the floating dev badges (route indicator + red error dot) in development.
  // Errors still surface in the terminal and the click-through overlay. No effect in production.
  devIndicators: { buildActivity: false, buildActivityPosition: 'bottom-right' },
  // Security headers on every response. The CSP allows exactly the external
  // origins the app actually uses (fonts, OSM map tiles, seller-uploaded media,
  // the OSRM routing fetch) — everything else is blocked. A stricter
  // nonce-based CSP would require removing the inline theme-bootstrap script.
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js requires inline/eval for its bootstrap + the inline theme
      // script; blob: covers workers. No external script origins are allowed.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://tile.openstreetmap.org",
      // Listing videos stream from Supabase Storage (media falls back to
      // default-src 'self' without this, which would block them).
      "media-src 'self' https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://router.project-osrm.org https://tile.openstreetmap.org",
      // No iframes are used anywhere (maps are Leaflet); block all framing.
      "frame-src 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default nextConfig;
