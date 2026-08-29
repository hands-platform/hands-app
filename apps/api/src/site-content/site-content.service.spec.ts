import {
  PublicSiteKey,
  PublicSiteRevisionReadinessState,
  PublicSiteRevisionState,
  PublicSiteSectionKind,
} from '@prisma/client';

import {
  normalizePublicSiteSection,
  publicSiteCacheInvalidationTargets,
  publicSiteManifestHealth,
  publicSiteManifestQueue,
  publicSiteRevisionReadiness,
  SiteContentService,
} from './site-content.service';

describe('SiteContentService revision contract', () => {
  it.each([
    ['HERO', { title: 'Hero' }],
    ['FAQ', { items: [{ question: 'Question', answer: 'Answer' }] }],
    ['LEGAL_DOCUMENT', { title: 'Terms', body: 'Body' }],
    ['CTA', { title: 'Book', actionLabel: 'Open', actionHref: '/book' }],
    ['APP_OVERVIEW', { title: 'Overview' }],
    ['PARTNER_DIRECTORY', { title: 'Partners' }],
    ['PARTNER_DETAIL', { title: 'Profile' }],
    ['RECRUITMENT_BENEFITS', { title: 'Benefits' }],
    ['RECRUITMENT_PROCESS', { title: 'Process' }],
    ['COMPANY_INFORMATION', { title: 'Company' }],
    ['CONTACT', { title: 'Contact' }],
  ])('normalizes a visible %s contract', (kind, content) => {
    expect(normalizePublicSiteSection(kind, content)).not.toBeNull();
  });

  it('keeps generic subtitle and image content visible while blocking unsafe or inaccessible media', () => {
    expect(normalizePublicSiteSection('APP_OVERVIEW', { subtitle: 'Visible subtitle' })).toMatchObject({ subtitle: 'Visible subtitle' });
    expect(normalizePublicSiteSection('APP_OVERVIEW', { imageUrl: '/images/app.jpg', imageAlt: 'HANDS app screen' })).toMatchObject({ imageUrl: '/images/app.jpg', imageAlt: 'HANDS app screen' });
    expect(normalizePublicSiteSection('APP_OVERVIEW', { imageUrl: '/images/app.jpg' })).toBeNull();
    expect(normalizePublicSiteSection('APP_OVERVIEW', { imageUrl: 'javascript:alert(1)', imageAlt: 'Unsafe' })).toBeNull();
    expect(normalizePublicSiteSection('APP_OVERVIEW', { title: 'Visible', actionLabel: 'Open', actionHref: 'javascript:alert(1)' })).toBeNull();
  });

  it('uses the same renderability contract for readiness and public output', () => {
    const ready = publicSiteRevisionReadiness({
      seoTitle: 'HANDS',
      seoDescription: 'Wellness at your door',
      sections: [{ key: 'hero', kind: 'HERO', enabled: true, content: { title: 'HANDS' } }],
    });
    expect(ready.state).toBe(PublicSiteRevisionReadinessState.READY);
    expect(normalizePublicSiteSection('HERO', { title: 'HANDS' })).toMatchObject({ variant: 'hero' });

    const blocked = publicSiteRevisionReadiness({
      seoTitle: 'HANDS',
      seoDescription: 'Wellness at your door',
      sections: [{ key: 'cta', kind: 'CTA', enabled: true, content: { title: 'Book', actionLabel: 'Open', actionHref: 'javascript:alert(1)' } }],
    });
    expect(blocked.state).toBe(PublicSiteRevisionReadinessState.BLOCKED);
    expect(normalizePublicSiteSection('CTA', { title: 'Book', actionLabel: 'Open', actionHref: 'javascript:alert(1)' })).toBeNull();
  });

  it('updates only the Draft revision and leaves the active pointer unchanged', async () => {
    const page = pageFixture();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const pageUpdate = vi.fn().mockResolvedValue(page);
    const tx = transactionClient(page, { pageUpdate, updateMany });
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await service.updatePage('operator-1', page.id, {
      seoTitle: 'Draft title changed',
      expectedVersion: page.draftRevision.version,
    });

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'draft-2', version: 3 }),
      data: expect.objectContaining({ seoTitle: 'Draft title changed', version: { increment: 1 } }),
    }));
    expect(pageUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ activeRevisionId: expect.anything() }),
    }));
  });

  it('resolves public content exclusively from the active revision while a Draft exists', async () => {
    const page = pageFixture();
    const prisma = { publicSitePage: { findFirst: vi.fn().mockResolvedValue(page) } };
    const service = new SiteContentService(prisma as never);

    const response = await service.resolvePublishedPage(PublicSiteKey.MAIN, 'vi', '/about');

    expect(response).toMatchObject({ revisionId: 'active-1', seoTitle: 'Live title', status: 'PUBLISHED' });
    expect(response?.sections[0]?.renderModel).toMatchObject({ title: 'Live hero' });
    expect(JSON.stringify(response)).not.toContain('Draft title');
  });

  it('preserves the first publishedAt when activating a newer Draft', async () => {
    const page = pageFixture();
    const pageUpdate = vi.fn().mockResolvedValue(page);
    const tx = transactionClient(page, { pageUpdate });
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await service.publishDraft('publisher-1', page.id, { revisionId: 'draft-2', expectedVersion: 3 });

    expect(pageUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activeRevisionId: 'draft-2',
        draftRevisionId: null,
        firstPublishedAt: page.firstPublishedAt,
        publishedAt: page.firstPublishedAt,
      }),
    }));
  });

  it('opens a Draft idempotently when one already exists', async () => {
    const page = pageFixture();
    const tx = transactionClient(page);
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    const result = await service.openDraft('operator-1', page.id);

    expect(result).toBe(page);
    expect(tx.publicSitePage.update).not.toHaveBeenCalled();
    expect(tx.publicSitePageRevision.create).not.toHaveBeenCalled();
  });

  it('discards only the Draft while preserving the active revision', async () => {
    const page = pageFixture();
    const pageUpdate = vi.fn().mockResolvedValue(page);
    const revisionDelete = vi.fn().mockResolvedValue({});
    const tx = transactionClient(page, { pageUpdate, revisionDelete });
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await service.discardDraft('operator-1', page.id);

    expect(pageUpdate).toHaveBeenCalledWith({
      where: { id: page.id },
      data: { draftRevisionId: null, updatedById: 'operator-1' },
    });
    expect(revisionDelete).toHaveBeenCalledWith({ where: { id: page.draftRevisionId } });
    expect(JSON.stringify(pageUpdate.mock.calls)).not.toContain('activeRevisionId');
  });

  it('does not update the active page pointer when revision activation fails', async () => {
    const page = pageFixture();
    const pageUpdate = vi.fn();
    const revisionUpdate = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));
    const tx = transactionClient(page, { pageUpdate, revisionUpdate });
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await expect(service.publishDraft('publisher-1', page.id, { revisionId: 'draft-2', expectedVersion: 3 })).rejects.toThrow('write failed');
    expect(pageUpdate).not.toHaveBeenCalled();
  });

  it('requires the current path before taking a Live page offline', async () => {
    const page = pageFixture();
    const tx = transactionClient(page);
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await expect(service.takeOffline('publisher-1', page.id, {
      confirmationPath: '/old-about',
      reason: 'Incorrect public content',
    })).rejects.toThrow('page path changed');
    expect(tx.publicSitePage.update).not.toHaveBeenCalled();
    expect(tx.publicSitePageRevision.update).not.toHaveBeenCalled();
  });

  it('archives the active revision and records visitor outcome when taking a page offline', async () => {
    const page = pageFixture();
    const tx = transactionClient(page);
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    const result = await service.takeOffline('publisher-1', page.id, {
      confirmationPath: '/about',
      reason: 'Incorrect public content',
    });

    expect(tx.publicSitePageRevision.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'active-1' },
      data: expect.objectContaining({ state: PublicSiteRevisionState.ARCHIVED }),
    }));
    expect(tx.publicSitePage.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activeRevisionId: null, publishedAt: null }),
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'PUBLIC_SITE_PAGE_TAKEN_OFFLINE' }) }));
    expect(result).toMatchObject({ idempotent: false, visitorOutcome: 'NOT_SERVED' });
  });

  it('refuses hard deletion when a page has Live history', async () => {
    const page = pageFixture();
    const tx = { ...transactionClient(page), publicSitePage: { ...transactionClient(page).publicSitePage, delete: vi.fn() } };
    const service = new SiteContentService({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await expect(service.deletePage('operator-1', page.id, {
      confirmationPath: '/about',
      reason: 'No longer required',
    })).rejects.toThrow('Live history');
    expect(tx.publicSitePage.delete).not.toHaveBeenCalled();
  });

  it('rejects invalid and expired preview tokens before returning Draft content', async () => {
    const page = pageFixture();
    const prisma = { publicSitePage: { findUnique: vi.fn().mockResolvedValue(page) } };
    const config = { get: vi.fn((key: string) => key === 'SITE_CONTENT_PREVIEW_SECRET' ? 'preview-secret-at-least-32-characters' : undefined) };
    const service = new SiteContentService(prisma as never, config as never);

    await expect(service.resolvePreview('not-a-signed-token')).rejects.toThrow('invalid');
    const preview = await service.createPreviewToken(page.id);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60_000);
    await expect(service.resolvePreview(preview.token)).rejects.toThrow('expired');
    clock.mockRestore();
  });

  it('does not reuse the Supabase JWT secret for draft preview signing', async () => {
    const page = pageFixture();
    const service = new SiteContentService(
      { publicSitePage: { findUnique: vi.fn().mockResolvedValue(page) } } as never,
      { get: vi.fn((key: string) => key === 'SUPABASE_JWT_SECRET' ? 'supabase-jwt-secret-at-least-32-characters' : undefined) } as never,
    );

    await expect(service.createPreviewToken(page.id)).rejects.toThrow(
      'Draft preview signing is not configured',
    );
    await expect(service.createPreviewToken(page.id)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SITE_CONTENT_PREVIEW_NOT_CONFIGURED' }),
    });
  });

  it('purges every configured Public Web host outside the mutation transaction and records only redacted evidence', async () => {
    const page = pageFixture();
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const config = { get: vi.fn((key: string) => ({
      NODE_ENV: 'production',
      SITE_CONTENT_CACHE_INVALIDATION_SECRET: 'cache-secret-at-least-32-characters-long',
      SITE_CONTENT_CACHE_INVALIDATION_URLS: 'https://hands.vn, https://join.hands.vn',
    } as Record<string, string>)[key]) };
    const service = new SiteContentService({
      publicSitePage: { findUnique: vi.fn().mockResolvedValue(page) },
      adminAuditLog: { create: auditCreate },
    } as never, config as never);

    const result = await service.retryPublicCacheInvalidation('publisher-1', page.id);

    expect(result).toMatchObject({ status: 'SUCCEEDED', hostCount: 2, succeededHostCount: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://hands.vn/api/site-content-cache',
      'https://join.hands.vn/api/site-content-cache',
    ]);
    const auditJson = JSON.stringify(auditCreate.mock.calls);
    expect(auditJson).toContain('PUBLIC_SITE_CACHE_INVALIDATION');
    expect(auditJson).not.toContain('cache-secret');
    expect(auditJson).not.toContain('https://');
    vi.unstubAllGlobals();
  });

  it('accepts local HTTP cache hosts only outside production and deduplicates them', () => {
    expect(publicSiteCacheInvalidationTargets('http://localhost:3200,http://localhost:3200', 'development')).toEqual([
      'http://localhost:3200/api/site-content-cache',
    ]);
    expect(publicSiteCacheInvalidationTargets('http://localhost:3200', 'production')).toEqual([]);
  });

  it('resolves revision publisher labels from bounded page audit evidence', async () => {
    const page = pageFixture();
    const service = new SiteContentService({
      publicSitePage: { findUnique: vi.fn().mockResolvedValue(page) },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([{
        id: 'audit-1',
        action: 'PUBLIC_SITE_DRAFT_PUBLISHED',
        createdAt: new Date(),
        actor: { id: 'publisher-0', fullName: 'Content Publisher', email: 'publisher@example.com' },
        metadata: { revisionId: 'active-1' },
      }]) },
    } as never);

    const result = await service.getAdminPage(page.id);

    expect(result.revisions[0]).toMatchObject({ id: 'active-1', publishedByLabel: 'Content Publisher' });
  });

  it('applies server pagination to route groups without returning section JSON', async () => {
    const page = pageFixture();
    const groupBy = vi.fn()
      .mockResolvedValueOnce([{ site: PublicSiteKey.MAIN, path: '/about' }])
      .mockResolvedValueOnce(Array.from({ length: 1_000 }, (_, index) => ({ site: PublicSiteKey.MAIN, path: `/page-${index}` })))
      .mockResolvedValueOnce([{ site: PublicSiteKey.MAIN, path: '/about', _count: { locale: 4 } }]);
    const findMany = vi.fn()
      .mockResolvedValueOnce([summaryRow(page)])
      .mockResolvedValueOnce([]);
    const prisma = {
      publicSitePage: { groupBy, findMany, count: vi.fn().mockResolvedValue(1) },
      publicSitePageRevision: { count: vi.fn().mockResolvedValue(1) },
      adminAuditLog: { count: vi.fn().mockResolvedValue(2) },
    };
    const service = new SiteContentService(prisma as never);

    const result = await service.listAdminPages({ contentType: 'pages', page: 2, take: 20 });

    expect(groupBy).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 20, take: 20 }));
    expect(result).toMatchObject({
      page: 2,
      take: 20,
      total: 1_000,
      summary: {
        manifestHealth: { missingRoutes: 35, missingTranslations: 175, staleTranslations: null },
        viewScope: { recentlyPublished: 1, scope: { contentType: 'pages' } },
      },
    });
    expect(JSON.stringify(findMany.mock.calls.map((call) => call[0]?.select))).not.toContain('"content"');
  });

  it('keeps global manifest health stable and makes both gap queues add up to the health counts', () => {
    const existing = [{ site: PublicSiteKey.MAIN, path: '/', locale: 'vi' }];
    const health = publicSiteManifestHealth(existing);
    const routeQueue = publicSiteManifestQueue(existing, 'missing-routes');
    const translationQueue = publicSiteManifestQueue(existing, 'missing-translations');

    expect(routeQueue).toHaveLength(health.missingRoutes);
    expect(translationQueue).toHaveLength(health.missingTranslations);
    expect(health.staleTranslations).toBeNull();
    expect(health.staleTranslationsApplicable).toBe(false);
    expect(routeQueue[0]).toEqual(expect.objectContaining({ site: expect.any(String), path: expect.any(String), locale: expect.any(String), reason: expect.any(String), recommendedAction: expect.any(String) }));
  });

  it('keeps the article list available when only summary aggregation fails', async () => {
    const page = pageFixture();
    const prisma = {
      publicSitePage: {
        findMany: vi.fn().mockResolvedValue([summaryRow(page)]),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockRejectedValue(new Error('summary unavailable')),
      },
      adminAuditLog: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = new SiteContentService(prisma as never);

    const result = await service.listAdminPages({ contentType: 'news' });

    expect(result.items).toHaveLength(1);
    expect(result.summary).toBeNull();
    expect(result.summaryAvailable).toBe(false);
  });

  it('keeps private and template routes out of the sitemap source', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new SiteContentService({ publicSitePage: { findMany } } as never);

    await service.listPublishedRoutes(PublicSiteKey.MAIN, 'vi');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        activeRevision: { is: { noIndex: false } },
        path: { not: { contains: '[' } },
      }),
    }));
  });

  it('rejects oversized structured content before querying Prisma', async () => {
    const service = new SiteContentService({} as never);
    await expect(service.createSection('operator-1', 'page-1', {
      key: 'overview',
      kind: PublicSiteSectionKind.APP_OVERVIEW,
      content: { body: 'x'.repeat(50_001) },
    })).rejects.toThrow('exceeds 50KB');
  });

  it('rejects unsupported section keys and unsafe links before querying Prisma', async () => {
    const service = new SiteContentService({} as never);
    await expect(service.createSection('operator-1', 'page-1', {
      key: 'overview',
      kind: PublicSiteSectionKind.APP_OVERVIEW,
      content: { title: 'Overview', experimentalHtml: '<script />' },
    })).rejects.toThrow('Unsupported content keys');
    await expect(service.createSection('operator-1', 'page-1', {
      key: 'cta',
      kind: PublicSiteSectionKind.CTA,
      content: { title: 'Book', actionLabel: 'Open', actionHref: 'javascript:alert(1)' },
    })).rejects.toThrow('relative path or HTTPS URL');
  });
});

function revision(id: string, state: PublicSiteRevisionState, overrides: Record<string, unknown> = {}) {
  return {
    id,
    pageId: 'page-1',
    revisionNumber: state === PublicSiteRevisionState.ACTIVE ? 1 : 2,
    version: state === PublicSiteRevisionState.ACTIVE ? 1 : 3,
    state,
    readinessState: PublicSiteRevisionReadinessState.READY,
    readinessIssues: [],
    seoTitle: state === PublicSiteRevisionState.ACTIVE ? 'Live title' : 'Draft title',
    seoDescription: 'A complete description',
    canonicalPath: '/about',
    noIndex: false,
    publishedAt: state === PublicSiteRevisionState.ACTIVE ? new Date('2026-01-01T00:00:00Z') : null,
    publishedById: state === PublicSiteRevisionState.ACTIVE ? 'publisher-0' : null,
    createdById: 'operator-1',
    updatedById: 'operator-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    sections: [{
      id: `${id}-hero`,
      revisionId: id,
      key: 'hero',
      kind: PublicSiteSectionKind.HERO,
      content: { title: state === PublicSiteRevisionState.ACTIVE ? 'Live hero' : 'Draft hero' },
      sortOrder: 0,
      enabled: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    }],
    ...overrides,
  };
}

function pageFixture() {
  const activeRevision = revision('active-1', PublicSiteRevisionState.ACTIVE);
  const draftRevision = revision('draft-2', PublicSiteRevisionState.DRAFT);
  return {
    id: 'page-1',
    site: PublicSiteKey.MAIN,
    locale: 'vi',
    path: '/about',
    internalName: 'About',
    activeRevisionId: activeRevision.id,
    draftRevisionId: draftRevision.id,
    firstPublishedAt: new Date('2025-12-15T00:00:00Z'),
    status: 'PUBLISHED',
    publishedAt: new Date('2025-12-15T00:00:00Z'),
    seoTitle: 'Live title',
    seoDescription: 'A complete description',
    canonicalPath: '/about',
    noIndex: false,
    createdById: 'operator-1',
    updatedById: 'operator-1',
    createdAt: new Date('2025-12-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    activeRevision,
    draftRevision,
    revisions: [activeRevision],
  };
}

function transactionClient(page: ReturnType<typeof pageFixture>, overrides: {
  pageUpdate?: ReturnType<typeof vi.fn>;
  revisionDelete?: ReturnType<typeof vi.fn>;
  revisionUpdate?: ReturnType<typeof vi.fn>;
  updateMany?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    publicSitePage: {
      findUnique: vi.fn().mockResolvedValue(page),
      update: overrides.pageUpdate ?? vi.fn().mockResolvedValue(page),
    },
    publicSitePageRevision: {
      create: vi.fn(),
      delete: overrides.revisionDelete ?? vi.fn().mockResolvedValue({}),
      update: overrides.revisionUpdate ?? vi.fn().mockResolvedValue({}),
      updateMany: overrides.updateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

function summaryRow(page: ReturnType<typeof pageFixture>) {
  return {
    id: page.id,
    site: page.site,
    locale: page.locale,
    path: page.path,
    internalName: page.internalName,
    firstPublishedAt: page.firstPublishedAt,
    updatedAt: page.updatedAt,
    activeRevision: { id: 'active-1', revisionNumber: 1, publishedAt: new Date(), updatedAt: new Date(), noIndex: false, _count: { sections: 1 } },
    draftRevision: { id: 'draft-2', revisionNumber: 2, version: 3, readinessState: PublicSiteRevisionReadinessState.READY, readinessIssues: [], updatedAt: new Date(), _count: { sections: 1 } },
  };
}
