import manifestData from '../../api/src/site-content/public-site-route-manifest.json';

import type { PublicSiteKey } from './site-content';

type PublicSiteRouteManifestEntry = {
  site: PublicSiteKey;
  path: string;
  label: string;
  publicTemplatePath: string;
  codeFallback: boolean;
};

export const publicSiteRouteManifest = manifestData as readonly PublicSiteRouteManifestEntry[];

export function publicSiteRouteContract(site: PublicSiteKey, requestedPath: string) {
  return publicSiteRouteManifest.find((entry) =>
    entry.site === site && routePattern(entry.path).test(requestedPath),
  ) ?? null;
}

export function publicSiteTemplatePathFromManifest(site: PublicSiteKey, requestedPath: string) {
  return publicSiteRouteContract(site, requestedPath)?.publicTemplatePath ?? requestedPath;
}

function routePattern(path: string) {
  const pattern = path
    .split('/')
    .map((segment) => /^\[[a-z]+\]$/u.test(segment) ? '[^/]+' : escapeRegExp(segment))
    .join('/');
  return new RegExp(`^${pattern}$`, 'u');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
