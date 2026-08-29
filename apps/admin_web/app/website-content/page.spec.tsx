import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import WebsiteContentPage from './page';

vi.mock('../../lib/admin-api', () => ({ adminGetResult: vi.fn() }));
vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn().mockResolvedValue({ categories: ['SYSTEM'] }) }));
vi.mock('../../lib/admin-operator-access-model', () => ({ hasAdminOperatorCategory: vi.fn().mockReturnValue(true) }));

const mockedGet = vi.mocked(adminGetResult);

describe('WebsiteContentPage', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('starts with a server-paginated Pages directory and no article form', async () => {
    mockedGet.mockResolvedValue({ data: listResult([routeGroup()]), ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ routePage: '2' }) }));

    expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('contentType=pages&page=2&take=20'), expect.anything());
    expect(html).toContain('Managed pages');
    expect(html).toContain('Draft changes');
    expect(html).toContain('admin-directory-filter-form');
    expect(html).toContain('action="/website-content"');
    expect(html).not.toContain('Article body');
    expect(html).not.toContain('Publish immediately');
  });

  it('distinguishes filtered empty from a read failure', async () => {
    mockedGet.mockResolvedValueOnce({ data: listResult([]), ok: true, status: 200 });
    const filtered = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ q: 'missing' }) }));
    expect(filtered).toContain('No pages match these filters');

    mockedGet.mockResolvedValueOnce({ data: listResult([]), ok: false, status: 503 });
    const failed = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({}) }));
    expect(failed).toContain('Pages could not be loaded');
    expect(failed).not.toContain('No managed pages yet');
  });

  it('keeps the directory visible when only summary counts are unavailable', async () => {
    mockedGet.mockResolvedValue({
      data: { ...listResult([routeGroup()]), summary: null, summaryAvailable: false },
      ok: true,
      status: 200,
    });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('Content summary is unavailable');
    expect(html).toContain('About HANDS');
    expect(html).not.toContain('Pages could not be loaded');
  });

  it('keeps global canonical health visible under filtered readiness and links to real queues', async () => {
    const result = listResult([routeGroup()]);
    result.summary.manifestHealth.missingRoutes = 19;
    result.summary.manifestHealth.missingTranslations = 95;
    mockedGet.mockResolvedValue({ data: result, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ readiness: 'UNKNOWN' }) }));

    expect(html).toContain('>19<');
    expect(html).toContain('>95<');
    expect(html).toContain('queue=missing-routes');
    expect(html).toContain('queue=missing-translations');
    expect(html).toContain('canonical health is global');
  });

  it('renders manifest diff rows as an actionable queue', async () => {
    const result = {
      ...listResult([]),
      items: [{ key: 'translation:MAIN:/about:ko', kind: 'MISSING_TRANSLATION', site: 'MAIN', path: '/about', locale: 'KO', label: 'About HANDS', ownership: 'CODE_FALLBACK', reason: 'No managed KO Draft exists.', recommendedAction: 'Create the missing language Draft.' }],
      total: 1,
    };
    mockedGet.mockResolvedValue({ data: result, ok: true, status: 200 } as never);

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ queue: 'missing-translations' }) }));

    expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('queue=missing-translations'), expect.anything());
    expect(html).toContain('Missing translation queue');
    expect(html).toContain('No managed KO Draft exists.');
    expect(html).toContain('Create the missing language Draft.');
  });

  it('separates visitor Live state from Draft work state in every locale cell', async () => {
    const group = routeGroup();
    const base = group.translations[0];
    const translations = [
      { ...base, id: 'ko', locale: 'ko', draftRevision: null },
      { ...base, id: 'en', locale: 'en', activeRevision: null },
      { ...base, id: 'vi', locale: 'vi', draftRevision: { ...base.draftRevision, readinessState: 'BLOCKED' } },
      { ...base, id: 'ja', locale: 'ja', activeRevision: null, draftRevision: { ...base.draftRevision, readinessState: 'UNKNOWN' } },
    ];
    mockedGet.mockResolvedValue({ data: listResult([{ ...group, translations }] as never), ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('KO · Live; No changes');
    expect(html).toContain('EN · Not live; Draft ready');
    expect(html).toContain('VI · Live; Draft blocked');
    expect(html).toContain('JA · Not live; Needs review');
    expect(html).toContain('ZH · Missing');
  });

  it('renders a selected route workspace without appending the global directory', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: detailPage(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'overview' }) }));

    expect(html).toContain('Current state');
    expect(html).toContain('Preview Draft');
    expect(html).toContain('Open Live page');
    expect(html).not.toContain('Managed pages');
    expect(html).not.toContain('Route filters');
  });

  it('keeps Draft editing available while hiding every destructive lifecycle entry point', async () => {
    vi.stubEnv('CMS_DESTRUCTIVE_LIFECYCLE_ENABLED', 'false');
    mockedGet
      .mockResolvedValueOnce({ data: detailPage(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({
      pageId: 'page-1',
      workspace: 'content',
      sectionId: 'section-1',
      deletePageId: 'page-1',
      deleteSectionId: 'section-1',
      discardDraft: '1',
      confirmPublish: '1',
      takeOffline: '1',
      rollbackRevisionId: 'active-1',
    }) }));

    expect(html).toContain('Manual publication only');
    expect(html).toContain('Preview Draft');
    expect(html).toContain('Edit Hero');
    expect(html).toContain('Save Draft section');
    expect(html).not.toContain('Delete this Draft route?');
    expect(html).not.toContain('Delete Draft section?');
    expect(html).not.toContain('Discard this Draft?');
    expect(html).not.toContain('Publish this Draft?');
    expect(html).not.toContain('Take this page offline?');
    expect(html).not.toContain('Restore previous Live revision?');
    expect(html).not.toContain('Review Draft discard');
    expect(html).not.toContain('Review take offline');
    expect(html).not.toContain('Review deletion');
  });

  it('does not present an unevaluated legacy Draft as ready to publish', async () => {
    const page = detailPage();
    const unknownDraft = {
      ...page.draftRevision,
      readinessState: 'UNKNOWN' as const,
      readinessIssues: [],
    };
    mockedGet
      .mockResolvedValueOnce({ data: { ...page, draftRevision: unknownDraft }, ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'overview' }) }));

    expect(html).toContain('Readiness has not been evaluated for this legacy Draft. Save the Draft before publishing.');
    expect(html).not.toContain('This Draft passes the shared renderer readiness checks.');
  });

  it('drops stale section query state from non-Content workspace links', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: detailPage(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'activity', sectionId: 'section-1' }) }));

    expect(html).toContain('href="/website-content?view=pages&amp;pageId=page-1&amp;workspace=activity"');
    expect(html).not.toContain('workspace=activity&amp;sectionId=section-1');
  });

  it('uses a section-kind layout and keeps the internal key in Advanced details', async () => {
    const page = detailPage();
    const draft = page.draftRevision!;
    const section = { ...draft.sections[0], content: { title: 'Hero title', imageUrl: '/images/hero.jpg', imageAlt: 'A partner preparing a room' } };
    mockedGet
      .mockResolvedValueOnce({ data: { ...page, draftRevision: { ...draft, sections: [section] } }, ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'content', sectionId: 'section-1' }) }));

    expect(html).toContain('Edit Hero');
    expect(html).not.toContain('Edit hero-1');
    expect(html).toContain('Internal section ID');
    expect(html).toContain('website-content-field-body');
    expect(html).toContain('website-content-field-image-url');
    expect(html).toContain('alt="A partner preparing a room"');
  });

  it('describes Activity as successful evidence and shows a human publisher label', async () => {
    const page = detailPage();
    const revisions = page.revisions.map((revision) => ({ ...revision, publishedByLabel: 'Content Publisher' }));
    mockedGet
      .mockResolvedValueOnce({ data: { ...page, revisions }, ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'activity' }) }));

    expect(html).toContain('Successful publishing, rollback, offline, deletion and cache refresh actions');
    expect(html).not.toContain('deletion attempts');
    expect(html).toContain('Content Publisher');
    expect(html).not.toContain('<code>publisher-1</code>');
  });

  it('surfaces preview configuration failure with a safe retry and no secret detail', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: detailPage(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: null, errorCode: 'SITE_CONTENT_PREVIEW_NOT_CONFIGURED', ok: false, status: 503 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1', workspace: 'overview' }) }));

    expect(html).toContain('Draft preview is not configured');
    expect(html).toContain('Retry preview');
    expect(html).not.toContain('SITE_CONTENT_PREVIEW_SECRET');
    expect(html).not.toContain('Preview Draft');
  });

  it('keeps a committed publish distinct from a pending public cache refresh', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: detailPage(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: { token: 'signed', path: '/about', locale: 'vi', site: 'MAIN', expiresAt: '2026-08-11T10:00:00Z', revisionId: 'draft-2', version: 3 }, ok: true, status: 200 });

    const html = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({
      pageId: 'page-1',
      status: 'published-cache-pending',
      workspace: 'publishing',
    }) }));

    expect(html).toContain('Draft published; public cache refresh pending');
    expect(html).toContain('Retry cache refresh only');
    expect(html).toContain('name="returnTo" value="/website-content?view=pages&amp;pageId=page-1&amp;workspace=publishing&amp;status=published-cache-pending"');
  });

  it('distinguishes detail permission, missing record, and retryable service failures', async () => {
    mockedGet.mockResolvedValueOnce({ data: null, ok: false, status: 403 }).mockResolvedValueOnce({ data: null, ok: false, status: 403 });
    expect(renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1' }) }))).toContain('Page access is not permitted');

    mockedGet.mockResolvedValueOnce({ data: null, ok: false, status: 404 }).mockResolvedValueOnce({ data: null, ok: false, status: 404 });
    expect(renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1' }) }))).toContain('This page no longer exists');

    mockedGet.mockResolvedValueOnce({ data: null, ok: false, status: 503 }).mockResolvedValueOnce({ data: null, ok: false, status: 503 });
    const unavailable = renderToStaticMarkup(await WebsiteContentPage({ searchParams: Promise.resolve({ pageId: 'page-1' }) }));
    expect(unavailable).toContain('Page details could not be loaded');
    expect(unavailable).toContain('Retry');
  });
});

function listResult(items: ReturnType<typeof routeGroup>[]) {
  return {
    items,
    page: 1,
    take: 20,
    total: items.length,
    totalPages: 1,
    summary: {
      viewScope: { routes: items.length, live: items.length, draftChanges: items.length, ready: items.length, needsAttention: 0, recentlyPublished: 1, scope: { contentType: 'pages' as const, site: null, locale: null, q: null, status: 'all', readiness: null, ownership: null } },
      manifestHealth: { scope: 'GLOBAL_CANONICAL' as const, expectedRoutes: 35, expectedRows: 175, missingRoutes: 0, missingTranslations: 0, staleTranslations: null, staleTranslationsApplicable: false },
      generatedAt: '2026-08-12T00:00:00Z',
    },
    summaryAvailable: true,
  };
}

function routeGroup() {
  return {
    groupKey: 'MAIN:/about',
    site: 'MAIN' as const,
    path: '/about',
    label: 'About HANDS',
    ownership: 'CODE_FALLBACK' as const,
    translations: [{
      id: 'page-1',
      site: 'MAIN' as const,
      locale: 'vi',
      path: '/about',
      internalName: 'About HANDS',
      manifestLabel: 'About HANDS',
      ownership: 'CODE_FALLBACK' as const,
      firstPublishedAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-10T00:00:00Z',
      activeRevision: { id: 'active-1', revisionNumber: 1, publishedAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', noIndex: false, _count: { sections: 1 } },
      draftRevision: { id: 'draft-2', revisionNumber: 2, version: 3, readinessState: 'READY' as const, readinessIssues: [], updatedAt: '2026-08-10T00:00:00Z', _count: { sections: 1 } },
    }],
  };
}

function detailPage() {
  const section = { id: 'section-1', revisionId: 'draft-2', key: 'hero', kind: 'HERO' as const, content: { title: 'Draft title' }, sortOrder: 0, enabled: true, updatedAt: '2026-08-10T00:00:00Z' };
  const draft = { id: 'draft-2', revisionNumber: 2, version: 3, state: 'DRAFT' as const, readinessState: 'READY' as const, readinessIssues: [], seoTitle: 'Draft title', seoDescription: 'Description', canonicalPath: '/about', noIndex: false, updatedAt: '2026-08-10T00:00:00Z', sections: [section] };
  const active = { ...draft, id: 'active-1', revisionNumber: 1, version: 1, state: 'ACTIVE' as const, seoTitle: 'Live title', publishedAt: '2026-08-01T00:00:00Z', publishedById: 'publisher-1', sections: [{ ...section, id: 'live-section', revisionId: 'active-1', content: { title: 'Live title' } }] };
  return { id: 'page-1', site: 'MAIN' as const, locale: 'vi', path: '/about', internalName: 'About HANDS', manifestLabel: 'About HANDS', ownership: 'CMS_LIVE' as const, offlineVisitorOutcome: 'CODE_FALLBACK' as const, activeRevisionId: 'active-1', draftRevisionId: 'draft-2', firstPublishedAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z', activeRevision: active, draftRevision: draft, revisions: [active], activity: [] };
}
