import { headers } from 'next/headers';

import { publicSiteTemplatePathFromManifest } from './public-site-route-manifest';

export const publicSiteLocales = ['vi', 'ko', 'en', 'ja', 'zh'] as const;
export const CMS_PREVIEW_COOKIE = 'hands_cms_preview';

export type PublicSiteLocale = (typeof publicSiteLocales)[number];
export type PublicSiteKey = 'MAIN' | 'PARTNER_RECRUITMENT';

export type PublicSitePage = {
  id: string;
  site: PublicSiteKey;
  locale: string;
  path: string;
  status: 'PUBLISHED' | 'DRAFT_PREVIEW';
  revisionId: string;
  revisionNumber: number;
  version: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  noIndex: boolean;
  updatedAt: string;
  sections: Array<{
    id: string;
    key: string;
    kind: string;
    renderModel: PublicSiteSectionRenderModel;
    sortOrder: number;
    enabled: boolean;
  }>;
};

export type PublicSiteContentItem = {
  title: string | null;
  body: string | null;
  href: string | null;
  label: string | null;
};

export type PublicSiteSectionRenderModel = {
  variant: 'hero' | 'faq' | 'document' | 'cta' | 'content';
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  actionLabel: string | null;
  actionHref: string | null;
  items: PublicSiteContentItem[];
};

type PublishedRoute = {
  path: string;
  updatedAt: string;
};

const API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export function isPublicSiteLocale(value: string): value is PublicSiteLocale {
  return publicSiteLocales.includes(value as PublicSiteLocale);
}

export async function publicSiteKeyForRequest(): Promise<PublicSiteKey> {
  const configured = process.env.PUBLIC_SITE_MODE;
  if (configured === 'PARTNER_RECRUITMENT') {
    return configured;
  }
  const host = (await headers()).get('host')?.split(':')[0]?.toLowerCase();
  return host === 'join.hands.vn' ? 'PARTNER_RECRUITMENT' : 'MAIN';
}

export function publicSiteBaseUrl(site: PublicSiteKey) {
  return site === 'PARTNER_RECRUITMENT'
    ? process.env.PUBLIC_SITE_RECRUITMENT_URL ?? 'https://join.hands.vn'
    : process.env.PUBLIC_SITE_MAIN_URL ?? 'https://hands.vn';
}

export function isPublicSiteIndexingEnabled() {
  return process.env.PUBLIC_SITE_INDEXING_ENABLED === 'true';
}

export async function fetchPublicSitePage(
  site: PublicSiteKey,
  locale: PublicSiteLocale,
  requestedPath: string,
) {
  const path = publicSiteTemplatePath(requestedPath, site);
  const query = new URLSearchParams({ site, locale, path });
  const response = await fetch(`${API_BASE_URL}/public/site-pages/resolve?${query}`, {
    next: { revalidate: 300, tags: [publicSitePageCacheTag(site, locale, path)] },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Public site page request failed with ${response.status}`);
  }
  return response.json() as Promise<PublicSitePage>;
}

export async function fetchPublicSitePreview(token: string) {
  const response = await fetch(`${API_BASE_URL}/public/site-pages/preview`, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new PublicSitePreviewError(response.status);
  }
  return response.json() as Promise<PublicSitePage>;
}

export class PublicSitePreviewError extends Error {
  constructor(readonly status: number) {
    super(`Public site preview request failed with ${status}`);
    this.name = 'PublicSitePreviewError';
  }
}

export async function fetchManagedPublicSitePage(
  previewToken: string | undefined,
  site: PublicSiteKey,
  locale: PublicSiteLocale,
  path: string,
) {
  if (!previewToken) {
    return { isPreview: false, previewRecovery: false, page: await fetchPublicSitePage(site, locale, path) };
  }
  try {
    const preview = await fetchPublicSitePreview(previewToken);
    if (preview.site === site && preview.locale === locale && preview.path === path) {
      return { isPreview: true, previewRecovery: false, page: preview };
    }
    return { isPreview: false, previewRecovery: true, page: await fetchPublicSitePage(site, locale, path) };
  } catch (error) {
    if (error instanceof PublicSitePreviewError && error.status === 401) {
      return { isPreview: false, previewRecovery: true, page: await fetchPublicSitePage(site, locale, path) };
    }
    throw error;
  }
}

export async function fetchPublishedRoutes(site: PublicSiteKey, locale: PublicSiteLocale) {
  const query = new URLSearchParams({ site, locale });
  try {
    const response = await fetch(`${API_BASE_URL}/public/site-pages/routes?${query}`, {
      next: { revalidate: 300, tags: [publicSiteRoutesCacheTag(site, locale)] },
    });
    if (!response.ok) {
      return [] as PublishedRoute[];
    }
    return response.json() as Promise<PublishedRoute[]>;
  } catch {
    return [] as PublishedRoute[];
  }
}

export function publicSiteTemplatePath(path: string, site: PublicSiteKey = 'MAIN') {
  return publicSiteTemplatePathFromManifest(site, path);
}

export function publicSitePageCacheTag(site: PublicSiteKey, locale: PublicSiteLocale, path: string) {
  return `public-site:page:${site}:${locale}:${encodeURIComponent(publicSiteTemplatePath(path, site))}`;
}

export function publicSiteRoutesCacheTag(site: PublicSiteKey, locale: PublicSiteLocale) {
  return `public-site:routes:${site}:${locale}`;
}

export function publicSiteNewsCacheTag(site: PublicSiteKey, locale: PublicSiteLocale) {
  return `public-site:news:${site}:${locale}`;
}

export function publicSiteCacheTags(site: PublicSiteKey, locale: PublicSiteLocale, path: string) {
  const tags = [
    publicSitePageCacheTag(site, locale, path),
    publicSiteRoutesCacheTag(site, locale),
  ];
  if (path === '/news' || path.startsWith('/news/')) tags.push(publicSiteNewsCacheTag(site, locale));
  return tags;
}
