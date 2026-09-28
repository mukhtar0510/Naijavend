import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated and transactional surfaces have nothing for crawlers.
        disallow: ['/dashboard', '/account', '/api/', '/checkout'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
