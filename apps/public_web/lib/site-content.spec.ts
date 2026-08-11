import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPublicSitePage,
  fetchPublicSitePreview,
  fetchPublishedRoutes,
  isPublicSiteIndexingEnabled,
  publicSiteTemplatePath,
} from './site-content';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PUBLIC_SITE_INDEXING_ENABLED;
});

describe('publicSiteTemplatePath', () => {
  it('maps partner directory routes to their managed templates', () => {
    expect(publicSiteTemplatePath('/partners/ho-chi-minh')).toBe('/partners/[city]');
    expect(publicSiteTemplatePath('/partners/ho-chi-minh/district-1')).toBe(
      '/partners/[city]/[district]',
    );
    expect(publicSiteTemplatePath('/partners/ho-chi-minh/district-1/partner-name')).toBe(
      '/partners/[city]/[district]/[slug]',
    );
    expect(publicSiteTemplatePath('/legal/privacy')).toBe('/legal/privacy');
  });

  it('keeps sitemap generation available when the content API is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchPublishedRoutes('MAIN', 'vi')).resolves.toEqual([]);
  });

  it('keeps search indexing disabled unless it is explicitly enabled', () => {
    expect(isPublicSiteIndexingEnabled()).toBe(false);

    process.env.PUBLIC_SITE_INDEXING_ENABLED = 'true';
    expect(isPublicSiteIndexingEnabled()).toBe(true);
  });

  it('keeps preview out of the public cache and does not hide CMS read failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'page-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchPublicSitePreview('signed-preview-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/public/site-pages/preview?token=signed-preview-token'),
      { cache: 'no-store' },
    );

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchPublicSitePage('MAIN', 'vi', '/about')).rejects.toThrow('503');
  });
});
