import {
  publicSiteLocales,
  publicSiteManifestEntry,
  publicSiteOwnership,
  publicSiteRouteManifest,
  publicSiteRouteKey,
} from './public-site-route-manifest';

describe('public site route manifest', () => {
  it('keeps every route and required locale unique and complete', () => {
    const keys = publicSiteRouteManifest.map((entry) => publicSiteRouteKey(entry.site, entry.path));
    expect(new Set(keys).size).toBe(keys.length);
    expect(publicSiteRouteManifest).toHaveLength(35);
    for (const entry of publicSiteRouteManifest) {
      expect(entry.requiredLocales).toEqual(expect.arrayContaining(publicSiteLocales));
      expect(entry.publicTemplatePath).toBe(entry.path);
    }
  });

  it('uses the district-aware Partner templates and rejects the stale route', () => {
    expect(publicSiteManifestEntry('MAIN', '/partners/[city]/[district]')).not.toBeNull();
    expect(publicSiteManifestEntry('MAIN', '/partners/[city]/[district]/[slug]')).not.toBeNull();
    expect(publicSiteManifestEntry('MAIN', '/partners/[city]/[slug]')).toBeNull();
  });

  it('derives public ownership without treating a code fallback as CMS Live', () => {
    expect(publicSiteOwnership('MAIN', '/', false)).toBe('CODE_FALLBACK');
    expect(publicSiteOwnership('MAIN', '/legal/app', false)).toBe('NOT_SERVED');
    expect(publicSiteOwnership('MAIN', '/', true)).toBe('CMS_LIVE');
    expect(publicSiteOwnership('MAIN', '/stale', false)).toBe('OWNERSHIP_CONFLICT');
  });
});
