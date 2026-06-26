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
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/refund-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
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
