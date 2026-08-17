import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import WebsiteContentPage from './page';

vi.mock('../../lib/admin-api', () => ({ adminGetResult: vi.fn() }));
vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn().mockResolvedValue({ categories: ['SYSTEM'] }) }));
vi.mock('../../lib/admin-operator-access-model', () => ({ hasAdminOperatorCategory: vi.fn().mockReturnValue(true) }));

const mockedGet = vi.mocked(adminGetResult);

describe('WebsiteContentPage', () => {
  beforeEach(() => vi.clearAllMocks());

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
});

function listResult(items: ReturnType<typeof routeGroup>[]) {
  return {
    items,
    page: 1,
    take: 20,
    total: items.length,
    totalPages: 1,
    summary: { routes: items.length, live: items.length, draftChanges: items.length, ready: items.length, needsAttention: 0, missingRoutes: 0, missingTranslations: 0, staleTranslations: 0, recentlyPublished: 1, scope: { contentType: 'pages', site: null, locale: null, q: null, status: 'all' }, generatedAt: '2026-08-12T00:00:00Z' },
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
