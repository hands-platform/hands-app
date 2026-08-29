import { AdminCatalogRoutes } from './admin-catalog.routes';

describe('CMS destructive lifecycle launch route gates', () => {
  it('rejects discard, publish, rollback, offline, page delete, and section delete before service calls', () => {
    vi.stubEnv('CMS_DESTRUCTIVE_LIFECYCLE_ENABLED', 'false');
    try {
      const admin = {
        deletePublicSitePage: vi.fn(),
        deletePublicSiteSection: vi.fn(),
        discardPublicSiteDraft: vi.fn(),
        publishPublicSiteDraft: vi.fn(),
        rollbackPublicSiteRevision: vi.fn(),
        takePublicSitePageOffline: vi.fn(),
      };
      const routes = new AdminCatalogRoutes(admin as never);
      const user = { id: 'admin-1' } as never;
      const expectedMessage = 'CMS destructive lifecycle is manual-only for the current launch';

      expect(() => routes.discardPublicSiteDraft(user, 'page-1')).toThrow(expectedMessage);
      expect(() => routes.publishPublicSiteDraft(user, 'page-1', {} as never)).toThrow(
        expectedMessage,
      );
      expect(() => routes.rollbackPublicSiteRevision(user, 'page-1', {} as never)).toThrow(
        expectedMessage,
      );
      expect(() => routes.takePublicSitePageOffline(user, 'page-1', {} as never)).toThrow(
        expectedMessage,
      );
      expect(() => routes.deletePublicSitePage(user, 'page-1', {} as never)).toThrow(
        expectedMessage,
      );
      expect(() => routes.deletePublicSiteSection(user, 'section-1')).toThrow(expectedMessage);

      expect(admin.discardPublicSiteDraft).not.toHaveBeenCalled();
      expect(admin.publishPublicSiteDraft).not.toHaveBeenCalled();
      expect(admin.rollbackPublicSiteRevision).not.toHaveBeenCalled();
      expect(admin.takePublicSitePageOffline).not.toHaveBeenCalled();
      expect(admin.deletePublicSitePage).not.toHaveBeenCalled();
      expect(admin.deletePublicSiteSection).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
