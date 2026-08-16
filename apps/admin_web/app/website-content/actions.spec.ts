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
  takePublicSitePageOffline,
  updatePublicSiteSection,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {
    constructor(readonly status: number) { super('request failed'); }
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

    await createPublicSiteNewsArticle(formData);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith('/admin/site-pages/news', {
      locale: 'ko',
      slug: 'first-story',
      title: 'First story',
      subtitle: 'Short summary',
      body: 'Full article body',
      imageUrl: '/images/news/first.jpg',
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
    mockedPost.mockResolvedValue({ visitorOutcome: 'CODE_FALLBACK' } as never);
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
  formData.set('returnTo', '/website-content?view=pages&pageId=page-1&workspace=content');
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
