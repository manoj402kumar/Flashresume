import { MetadataRoute } from 'next'
import { seoPages } from '@/lib/seo-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://flashresume.in';

  // Base routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/scratch`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Dynamic SEO routes
  const dynamicRoutes: MetadataRoute.Sitemap = seoPages.map((page) => ({
    url: `${baseUrl}/resume-templates/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.9, // High priority because these are capture pages
  }));

  return [...routes, ...dynamicRoutes];
}
