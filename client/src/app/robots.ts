import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://vidaloca.nexusaiholding.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy'],
        disallow: ['/admin', '/dashboard', '/reset-password'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
