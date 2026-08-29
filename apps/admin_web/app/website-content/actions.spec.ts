import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { beforeEach, vi } from 'vitest';

import {
  adminDeleteWithBodyOrThrow,
  adminDeleteOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  createPublicSiteNewsArticleState,
  createPublicSiteNewsArticle,
  deletePublicSitePage,
  deletePublicSiteSection,
  discardPublicSiteDraft,
  openPublicSiteDraft,
  publishPublicSiteDraft,
  retryPublicSiteCacheInvalidation,
  rollbackPublicSiteRevision,
  takePublicSitePageOffline,
  updatePublicSiteNewsArticleState,
  updatePublicSitePageState,
  updatePublicSiteSection,
  updatePublicSiteSectionState,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {
    constructor(_method: string, _path: string, readonly status: number) { super('request failed'); }
  },
  adminDeleteWithBodyOrThrow: vi.fn(),
  adminDeleteOrThrow: vi.fn(),
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedPatch = vi.mocked(adminPatchOrThrow);
const mockedDeleteWithBody = vi.mocked(adminDeleteWithBodyOrThrow);
const mockedDelete = vi.mocked(adminDeleteOrThrow);
const mockedPost = vi.mocked(adminPostOrThrow);

describe('website content actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks every destructive lifecycle action before the Admin API in manual-only mode', async () => {
    vi.stubEnv('CMS_DESTRUCTIVE_LIFECYCLE_ENABLED', 'false');
    try {
      const actions = [
        deletePublicSitePage,
        takePublicSitePageOffline,
        deletePublicSiteSection,
        discardPublicSiteDraft,
        publishPublicSiteDraft,
        rollbackPublicSiteRevision,
      ];

      for (const action of actions) await action(new FormData());

      expect(mockedPost).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedDeleteWithBody).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledTimes(actions.length);
      expect(vi.mocked(redirect).mock.calls.every(([href]) =>
        String(href).includes('status=lifecycle-manual-only'))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('updates only the Draft section with optimistic concurrency', async () => {
    mockedPatch.mockResolvedValue({ id: 'section-1' } as never);
    const formData = sectionForm();
    formData.set('useAdvancedJson', 'on');
    formData.set('advancedContentJson', '{"title":"Privacy"}');

    await updatePublicSiteSection(formData);

    expect(mockedPatch).toHaveBeenCalledWith('/admin/site-pages/sections/section-1', {
      key: 'partner-directory',
      kind: 'PARTNER_DIRECTORY',
      content: { title: 'Privacy' },
      sortOrder: 0,
      enabled: true,
      expectedVersion: 4,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/website-content');
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=section-updated'));
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('sectionId=section-1'));
  });

  it('shows invalid content without calling the API', async () => {
    const formData = sectionForm();
    formData.set('useAdvancedJson', 'on');
    formData.set('advancedContentJson', '{invalid');

    await updatePublicSiteSection(formData);

    expect(mockedPatch).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=invalid-content'));
  });

  it('uses visible fields unless the operator explicitly enables Advanced JSON', async () => {
    mockedPatch.mockResolvedValue({ id: 'section-1' } as never);
    const formData = sectionForm();
    formData.set('title', 'Visible field title');
    formData.set('advancedContentJson', '{"title":"Stale JSON title"}');

    await updatePublicSiteSection(formData);

    expect(mockedPatch).toHaveBeenCalledWith(
      '/admin/site-pages/sections/section-1',
      expect.objectContaining({ content: expect.objectContaining({ title: 'Visible field title' }) }),
    );
  });

  it.each([400, 409, 429, 503])('keeps SEO inputs in typed state after a %s response', async (status) => {
    const ErrorType = (await import('../../lib/admin-api')).AdminApiRequestError;
    mockedPatch.mockRejectedValue(new ErrorType('PATCH', '/admin/site-pages/page-1', status) as never);
    const formData = new FormData();
    formData.set('pageId', 'page-1');
    formData.set('expectedVersion', '4');
    formData.set('internalName', 'Preserved operator label');
    formData.set('seoTitle', 'Preserved SEO title');

    const state = await updatePublicSitePageState({ status: 'idle' }, formData);

    expect(state.status).toBe('error');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('returns an inline Advanced JSON error without redirecting or calling the API', async () => {
    const formData = sectionForm();
    formData.set('useAdvancedJson', 'on');
    formData.set('advancedContentJson', '{invalid');

    const state = await updatePublicSiteSectionState({ status: 'idle' }, formData);

    expect(state).toMatchObject({ status: 'error', fieldErrors: { advancedContentJson: expect.any(String) } });
    expect(mockedPatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('rejects an oversized existing article in typed state while preserving the form', async () => {
    const formData = new FormData();
    formData.set('pageId', 'page-1');
    formData.set('revisionId', 'draft-2');
    formData.set('expectedVersion', '4');
    formData.set('locale', 'vi');
    formData.set('slug', 'story');
    formData.set('title', 'Title');
    formData.set('subtitle', 'Subtitle');
    formData.set('body', 'x'.repeat(50_001));

    const state = await updatePublicSiteNewsArticleState({ status: 'idle' }, formData);

    expect(state).toMatchObject({ status: 'error', fieldErrors: { body: expect.any(String) } });
    expect(mockedPatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('requires the exact section id before deletion', async () => {
    const formData = new FormData();
    formData.set('pageId', 'page-1');
    formData.set('sectionId', 'section-1');
    formData.set('confirmationId', 'section-2');

    await deletePublicSiteSection(formData);

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=confirmation-required'));
  });

  it('creates an article through one atomic Draft endpoint and never publishes implicitly', async () => {
    mockedPost.mockResolvedValue({ id: 'page-1' } as never);
    const formData = new FormData();
    formData.set('locale', 'ko');
    formData.set('slug', 'first-story');
    formData.set('title', 'First story');
    formData.set('subtitle', 'Short summary');
    formData.set('body', 'Full article body');
    formData.set('imageUrl', '/images/news/first.jpg');
    formData.set('imageAlt', 'Partner arriving for an appointment');

    await createPublicSiteNewsArticle(formData);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith('/admin/site-pages/news', {
      locale: 'ko',
      slug: 'first-story',
      title: 'First story',
      subtitle: 'Short summary',
      body: 'Full article body',
      imageUrl: '/images/news/first.jpg',
      imageAlt: 'Partner arriving for an appointment',
    });
    expect(mockedPatch).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=news-draft-created'));
  });

  it('keeps invalid article values in the typed action state without calling the API', async () => {
    const formData = new FormData();
    formData.set('locale', 'vi');
    formData.set('slug', 'Invalid Slug');
    formData.set('title', 'Draft title');
    formData.set('subtitle', 'Draft subtitle');
    formData.set('body', 'Draft body');

    const state = await createPublicSiteNewsArticleState({ status: 'idle' }, formData);

    expect(state).toEqual(expect.objectContaining({ status: 'error', fieldErrors: expect.objectContaining({ slug: expect.any(String) }) }));
    expect(mockedPost).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends typed path and reason for take offline and deletion', async () => {
    mockedPost.mockResolvedValue({
      cacheInvalidation: { status: 'SUCCEEDED', requestId: 'request-1', hostCount: 1, succeededHostCount: 1 },
      visitorOutcome: 'CODE_FALLBACK',
    } as never);
    mockedDeleteWithBody.mockResolvedValue(undefined as never);
    const offline = destructivePageForm();
    const deletion = destructivePageForm();

    await takePublicSitePageOffline(offline);
    await deletePublicSitePage(deletion);

    expect(mockedPost).toHaveBeenCalledWith('/admin/site-pages/page-1/take-offline', {
      confirmationPath: '/about',
      reason: 'Incorrect public content',
    });
    expect(mockedDeleteWithBody).toHaveBeenCalledWith('/admin/site-pages/page-1', {
      confirmationPath: '/about',
      reason: 'Incorrect public content',
    });
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=offline-fallback'));
  });

  it('reports a committed publish separately from a pending cache purge and retries cache only', async () => {
    mockedPost
      .mockResolvedValueOnce({ cacheInvalidation: { status: 'FAILED', requestId: 'request-1', hostCount: 2, succeededHostCount: 1 } } as never)
      .mockResolvedValueOnce({ status: 'SUCCEEDED', requestId: 'request-2', hostCount: 2, succeededHostCount: 2 } as never);
    const formData = new FormData();
    formData.set('pageId', 'page-1');
    formData.set('revisionId', 'draft-2');
    formData.set('expectedVersion', '3');
    formData.set('returnTo', '/website-content?view=pages&pageId=page-1&workspace=publishing');

    await publishPublicSiteDraft(formData);
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=published-cache-pending'));

    vi.mocked(redirect).mockClear();
    await retryPublicSiteCacheInvalidation(formData);
    expect(mockedPost).toHaveBeenLastCalledWith('/admin/site-pages/page-1/cache-invalidation', {});
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=cache-refreshed'));
  });

  it('opens an editable Draft through the dedicated endpoint', async () => {
    mockedPost.mockResolvedValue({ id: 'page-1' } as never);
    const formData = new FormData();
    formData.set('pageId', 'page-1');

    await openPublicSiteDraft(formData);

    expect(mockedPost).toHaveBeenCalledWith('/admin/site-pages/page-1/draft', {});
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=draft-opened'));
  });

  it('requires the exact page id before discarding a Draft', async () => {
    const formData = new FormData();
    formData.set('pageId', 'page-1');
    formData.set('confirmationId', 'page-2');

    await discardPublicSiteDraft(formData);

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('status=confirmation-required'));
  });
});

function sectionForm() {
  const formData = new FormData();
  formData.set('pageId', 'page-1');
  formData.set('sectionId', 'section-1');
  formData.set('expectedVersion', '4');
  formData.set('key', 'partner-directory');
  formData.set('kind', 'PARTNER_DIRECTORY');
  formData.set('sortOrder', '0');
  formData.set('enabled', 'on');
  formData.set('returnTo', '/website-content?view=pages&pageId=page-1&workspace=content&sectionId=section-1');
  return formData;
}

function destructivePageForm() {
  const formData = new FormData();
  formData.set('pageId', 'page-1');
  formData.set('confirmationPath', '/about');
  formData.set('reason', 'Incorrect public content');
  formData.set('returnTo', '/website-content?view=pages&pageId=page-1');
  return formData;
}
