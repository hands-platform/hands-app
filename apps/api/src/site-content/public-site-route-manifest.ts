import type { PublicSiteKey, PublicSiteSectionKind } from '@prisma/client';

import * as manifestModule from './public-site-route-manifest.json';

export const publicSiteLocales = ['vi', 'ko', 'en', 'ja', 'zh'] as const;
export type PublicSiteLocale = (typeof publicSiteLocales)[number];
export type PublicSiteOwnership =
  | 'CMS_LIVE'
  | 'CODE_FALLBACK'
  | 'NOT_SERVED'
  | 'OWNERSHIP_CONFLICT';

export type PublicSiteRouteManifestEntry = {
  site: PublicSiteKey;
  path: string;
  label: string;
  requiredLocales: readonly PublicSiteLocale[];
  sectionKinds: readonly PublicSiteSectionKind[];
  publicTemplatePath: string;
  codeFallback: boolean;
};

const manifestData = Array.isArray(manifestModule)
  ? manifestModule
  : (manifestModule as unknown as { default: PublicSiteRouteManifestEntry[] }).default;

export const publicSiteRouteManifest = validateManifest(manifestData as PublicSiteRouteManifestEntry[]);

export function publicSiteRouteKey(site: PublicSiteKey, path: string) {
  return `${site}:${path}`;
}

export function publicSiteManifestEntry(site: PublicSiteKey, path: string) {
  return publicSiteRouteManifest.find((entry) => entry.site === site && entry.path === path) ?? null;
}

export function publicSiteOwnership(
  site: PublicSiteKey,
  path: string,
  hasCmsLive: boolean,
): PublicSiteOwnership {
  const entry = publicSiteManifestEntry(site, path);
  if (!entry) return 'OWNERSHIP_CONFLICT';
  if (hasCmsLive) return 'CMS_LIVE';
  return entry.codeFallback ? 'CODE_FALLBACK' : 'NOT_SERVED';
}

function validateManifest(entries: PublicSiteRouteManifestEntry[]) {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = publicSiteRouteKey(entry.site, entry.path);
    if (seen.has(key)) throw new Error(`Duplicate public site route manifest entry: ${key}`);
    seen.add(key);
    if (entry.path !== entry.publicTemplatePath) {
      throw new Error(`Public template path does not match managed route: ${key}`);
    }
    const locales = new Set(entry.requiredLocales);
    if (locales.size !== publicSiteLocales.length || publicSiteLocales.some((locale) => !locales.has(locale))) {
      throw new Error(`Required locale matrix is incomplete: ${key}`);
    }
    const placeholders = entry.path.match(/\[[a-z]+\]/gu) ?? [];
    if (placeholders.some((placeholder) => !['[city]', '[district]', '[slug]'].includes(placeholder))) {
      throw new Error(`Unsupported public route placeholder: ${key}`);
    }
  }
  return entries as readonly PublicSiteRouteManifestEntry[];
}
