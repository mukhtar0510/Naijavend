import type { MetadataRoute } from 'next';
import { supabaseAnon } from '@/lib/supabase';
import { siteUrl } from '@/lib/site';

export const revalidate = 3600; // ISR — fresh sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/discover`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/rankings`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/search`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/legal`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/cookies`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const { data: stores, error } = await supabaseAnon()
      .from('stores')
      .select('slug, updated_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const storeRoutes: MetadataRoute.Sitemap = (stores ?? []).map((s) => ({
      url: `${base}/s/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at as string) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    return [...staticRoutes, ...storeRoutes];
  } catch (err) {
    // Sitemap must never hard-fail the deployment; static routes alone are still valid.
    console.error('[sitemap] failed to list stores:', err);
    return staticRoutes;
  }
}
