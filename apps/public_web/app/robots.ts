import type { MetadataRoute } from 'next';

import {
  isPublicSiteIndexingEnabled,
  publicSiteBaseUrl,
} from '../lib/site-content';

export default function robots(): MetadataRoute.Robots {
  const indexingEnabled = isPublicSiteIndexingEnabled();
  const site =
    process.env.PUBLIC_SITE_MODE === 'PARTNER_RECRUITMENT'
      ? 'PARTNER_RECRUITMENT'
      : 'MAIN';
  return {
    rules: {
      userAgent: '*',
      ...(indexingEnabled ? { allow: '/' } : { disallow: '/' }),
    },
    sitemap: indexingEnabled ? `${publicSiteBaseUrl(site)}/sitemap.xml` : undefined,
  };
}
