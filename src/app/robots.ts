import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/result', '/analyze', '/auth/callback'],
    },
    sitemap: 'https://flashresume.in/sitemap.xml',
  }
}
