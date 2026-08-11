import type { MetadataRoute } from 'next';

import {
  fetchPublicPartners,
  publicPartnerAreas,
  publicPartnerDetailPath,
  type PublicPartner,
} from '../lib/public-partners';
import {
  fetchPublishedRoutes,
  isPublicSiteIndexingEnabled,
  publicSiteBaseUrl,
  publicSiteLocales,
  type PublicSiteKey,
} from '../lib/site-content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isPublicSiteIndexingEnabled()) {
    return [];
  }
  const site: PublicSiteKey =
    process.env.PUBLIC_SITE_MODE === 'PARTNER_RECRUITMENT'
      ? 'PARTNER_RECRUITMENT'
      : 'MAIN';
  const baseUrl = publicSiteBaseUrl(site);
  const routeGroups = await Promise.all(
    publicSiteLocales.map(async (locale) => ({
      locale,
      routes: await fetchPublishedRoutes(site, locale),
    })),
  );
  const managedRoutes = routeGroups.flatMap(({ locale, routes }) =>
    routes.map((route) => ({
      url: `${baseUrl}/${locale}${route.path === '/' ? '' : route.path}`,
      lastModified: route.updatedAt,
    })),
  );

  const defaultRoutes =
    site === 'PARTNER_RECRUITMENT'
      ? recruitmentFallbackRoutes(baseUrl)
      : await publicPartnerSitemapRoutes(baseUrl);
  return Array.from(
    new Map([...managedRoutes, ...defaultRoutes].map((route) => [route.url, route])).values(),
  );
}

async function publicPartnerSitemapRoutes(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const documentPaths = [
    '/company',
    '/service-areas',
    '/contact',
    '/support/faq',
    '/safety',
    '/support/disputes',
    '/partner-policy',
    '/legal/partner-terms',
    '/legal/privacy',
    '/legal/terms',
    '/legal/cookies',
    '/company-info',
    '/referrals',
    '/news',
    '/news/welcome-to-hands',
  ];
  const routes: MetadataRoute.Sitemap = publicSiteLocales.flatMap((locale) => [
    { url: `${baseUrl}/${locale}` },
    { url: `${baseUrl}/${locale}/partners` },
    ...documentPaths.map((path) => ({ url: `${baseUrl}/${locale}${path}` })),
    ...publicPartnerAreas.flatMap((city) => [
      { url: `${baseUrl}/${locale}/partners/${city.slug}` },
      ...city.districts.map(([district]) => ({
        url: `${baseUrl}/${locale}/partners/${city.slug}/${district}`,
      })),
    ]),
  ]);
  const partners: PublicPartner[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const directory = await fetchPublicPartners({ page, take: 48 });
    partners.push(...directory.items);
    totalPages = directory.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  routes.push(
    ...publicSiteLocales.flatMap((locale) =>
      partners.map((partner) => ({
        url: `${baseUrl}${publicPartnerDetailPath(partner, locale)}`,
      })),
    ),
  );
  return routes;
}

function recruitmentFallbackRoutes(baseUrl: string): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/vi` },
    ...[
      '/company',
      '/service-areas',
      '/contact',
      '/safety',
      '/support/disputes',
      '/partner-policy',
      '/legal/partner-terms',
      '/legal/privacy',
      '/company-info',
    ].map((path) => ({ url: `${baseUrl}/vi${path}` })),
  ];
}
