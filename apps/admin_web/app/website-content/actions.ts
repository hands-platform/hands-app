'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
  adminDeleteWithBodyOrThrow,
  adminDeleteOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import type {
  PublicSitePageDetail,
  PublicSiteSection,
  PublicSiteSectionKind,
} from './website-content-types';

export async function createPublicSitePage(formData: FormData) {
  await runAction(formData, async () => {
    const page = await adminPostOrThrow<PublicSitePageDetail>('/admin/site-pages', {
      site: requiredValue(formData, 'site'),
      locale: requiredValue(formData, 'locale'),
      path: requiredValue(formData, 'path'),
      internalName: requiredValue(formData, 'internalName'),
      status: 'DRAFT',
      seoTitle: optionalValue(formData, 'seoTitle'),
      seoDescription: optionalValue(formData, 'seoDescription'),
      canonicalPath: optionalValue(formData, 'canonicalPath'),
      noIndex: true,
    });
    return { status: 'created', pageId: page.id };
  });
}

export type WebsiteContentActionState = {
  status: 'idle' | 'error';
  error?: string;
  fieldErrors?: Record<string, string>;
  retryMode?: 'reload-first';
};

export async function createPublicSitePageState(
  _previous: WebsiteContentActionState,
  formData: FormData,
): Promise<WebsiteContentActionState> {
  const fieldErrors = validatePageForm(formData);
  if (Object.keys(fieldErrors).length) return validationState(fieldErrors);
  let page: PublicSitePageDetail;
  try {
    page = await adminPostOrThrow<PublicSitePageDetail>('/admin/site-pages', {
      site: requiredValue(formData, 'site'),
      locale: requiredValue(formData, 'locale'),
      path: requiredValue(formData, 'path'),
      internalName: requiredValue(formData, 'internalName'),
      status: 'DRAFT',
      seoTitle: optionalValue(formData, 'seoTitle'),
      seoDescription: optionalValue(formData, 'seoDescription'),
      canonicalPath: optionalValue(formData, 'canonicalPath'),
      noIndex: true,
    });
  } catch (error) {
    return websiteContentErrorState(error);
  }
  finish('created', page.id, formData);
}

export async function updatePublicSitePage(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPatchOrThrow<PublicSitePageDetail>(`/admin/site-pages/${pageId}`, {
      internalName: requiredValue(formData, 'internalName'),
      seoTitle: optionalValue(formData, 'seoTitle'),
      seoDescription: optionalValue(formData, 'seoDescription'),
      canonicalPath: optionalValue(formData, 'canonicalPath'),
      noIndex: formData.get('noIndex') === 'on',
      expectedVersion: integerValue(formData, 'expectedVersion'),
    });
    return { status: 'draft-saved', pageId };
  });
}

export async function deletePublicSitePage(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminDeleteWithBodyOrThrow(`/admin/site-pages/${pageId}`, {
      confirmationPath: requiredValue(formData, 'confirmationPath'),
      reason: requiredValue(formData, 'reason'),
    });
    return { status: 'deleted' };
  });
}

export async function takePublicSitePageOffline(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    const result = await adminPostOrThrow<{ visitorOutcome: 'CODE_FALLBACK' | 'NOT_SERVED' }>(
      `/admin/site-pages/${pageId}/take-offline`,
      {
        confirmationPath: requiredValue(formData, 'confirmationPath'),
        reason: requiredValue(formData, 'reason'),
      },
    );
    return {
      status: result.visitorOutcome === 'CODE_FALLBACK' ? 'offline-fallback' : 'offline-not-served',
      pageId,
    };
  });
}

export async function createPublicSiteSection(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  const kind = requiredValue(formData, 'kind') as PublicSiteSectionKind;
  const sortOrder = nonNegativeIntegerValue(formData, 'sortOrder');
  await runAction(formData, async () => {
    await adminPostOrThrow<PublicSiteSection>(`/admin/site-pages/${pageId}/sections`, {
      key: optionalValue(formData, 'key') ?? `${kind.toLowerCase().replaceAll('_', '-')}-${sortOrder + 1}`,
      kind,
      sortOrder,
      enabled: true,
      content: {},
    });
    return { status: 'section-created', pageId };
  });
}

export async function updatePublicSiteSection(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  const sectionId = requiredValue(formData, 'sectionId');
  await runAction(formData, async () => {
    const content = sectionContent(formData);
    await adminPatchOrThrow<PublicSiteSection>(`/admin/site-pages/sections/${sectionId}`, {
      key: requiredValue(formData, 'key'),
      kind: requiredValue(formData, 'kind') as PublicSiteSectionKind,
      content,
      sortOrder: nonNegativeIntegerValue(formData, 'sortOrder'),
      enabled: formData.get('enabled') === 'on',
      expectedVersion: integerValue(formData, 'expectedVersion'),
    });
    return { status: 'section-updated', pageId };
  });
}

export async function deletePublicSiteSection(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  const sectionId = requiredValue(formData, 'sectionId');
  if (optionalValue(formData, 'confirmationId') !== sectionId) {
    return finish('confirmation-required', pageId, formData);
  }
  await runAction(formData, async () => {
    await adminDeleteOrThrow(`/admin/site-pages/sections/${sectionId}`);
    return { status: 'section-deleted', pageId };
  });
}

export async function createPublicSiteNewsArticle(formData: FormData) {
  await runAction(formData, async () => {
    const page = await adminPostOrThrow<PublicSitePageDetail>('/admin/site-pages/news', {
      locale: requiredValue(formData, 'locale'),
      slug: slugValue(formData),
      title: requiredValue(formData, 'title'),
      subtitle: requiredValue(formData, 'subtitle'),
      body: requiredValue(formData, 'body'),
      imageUrl: optionalValue(formData, 'imageUrl'),
    });
    return { status: 'news-draft-created', pageId: page.id };
  });
}

export async function createPublicSiteNewsArticleState(
  _previous: WebsiteContentActionState,
  formData: FormData,
): Promise<WebsiteContentActionState> {
  const fieldErrors = validateNewsForm(formData);
  if (Object.keys(fieldErrors).length) return validationState(fieldErrors);
  let page: PublicSitePageDetail;
  try {
    page = await adminPostOrThrow<PublicSitePageDetail>('/admin/site-pages/news', {
      locale: requiredValue(formData, 'locale'),
      slug: requiredValue(formData, 'slug'),
      title: requiredValue(formData, 'title'),
      subtitle: requiredValue(formData, 'subtitle'),
      body: requiredValue(formData, 'body'),
      imageUrl: optionalValue(formData, 'imageUrl'),
    });
  } catch (error) {
    return websiteContentErrorState(error);
  }
  finish('news-draft-created', page.id, formData);
}

export async function updatePublicSiteNewsArticle(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPatchOrThrow<PublicSitePageDetail>(`/admin/site-pages/${pageId}/news-draft`, {
      locale: requiredValue(formData, 'locale'),
      slug: slugValue(formData),
      title: requiredValue(formData, 'title'),
      subtitle: requiredValue(formData, 'subtitle'),
      body: requiredValue(formData, 'body'),
      imageUrl: optionalValue(formData, 'imageUrl'),
      revisionId: requiredValue(formData, 'revisionId'),
      expectedVersion: integerValue(formData, 'expectedVersion'),
    });
    return { status: 'news-draft-saved', pageId };
  });
}

export async function openPublicSiteDraft(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPostOrThrow(`/admin/site-pages/${pageId}/draft`, {});
    return { status: 'draft-opened', pageId };
  });
}

export async function discardPublicSiteDraft(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  if (optionalValue(formData, 'confirmationId') !== pageId) {
    return finish('confirmation-required', pageId, formData);
  }
  await runAction(formData, async () => {
    await adminDeleteOrThrow(`/admin/site-pages/${pageId}/draft`);
    return { status: 'draft-discarded', pageId };
  });
}

export async function publishPublicSiteDraft(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPostOrThrow(`/admin/site-pages/${pageId}/publish`, {
      revisionId: requiredValue(formData, 'revisionId'),
      expectedVersion: integerValue(formData, 'expectedVersion'),
    });
    return { status: 'published', pageId };
  });
}

export async function rollbackPublicSiteRevision(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPostOrThrow(`/admin/site-pages/${pageId}/rollback`, {
      revisionId: requiredValue(formData, 'revisionId'),
      reason: requiredValue(formData, 'reason'),
    });
    return { status: 'rolled-back', pageId };
  });
}

function sectionContent(formData: FormData) {
  const advanced = optionalValue(formData, 'advancedContentJson');
  if (formData.get('useAdvancedJson') === 'on' && advanced) {
    try {
      const parsed = JSON.parse(advanced);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      throw new Error('Advanced JSON must be a valid object.');
    }
  }
  const items = optionalValue(formData, 'itemsJson');
  const faqItems = optionalValue(formData, 'faqItems');
  return {
    eyebrow: optionalValue(formData, 'eyebrow'),
    title: optionalValue(formData, 'title'),
    subtitle: optionalValue(formData, 'subtitle'),
    body: optionalValue(formData, 'body'),
    imageUrl: optionalValue(formData, 'imageUrl'),
    actionLabel: optionalValue(formData, 'actionLabel'),
    actionHref: optionalValue(formData, 'actionHref'),
    ...(faqItems
      ? { items: faqItems.split(/\r?\n/u).flatMap((line) => {
          const separator = line.indexOf('|');
          if (separator < 1) return [];
          const question = line.slice(0, separator).trim();
          const answer = line.slice(separator + 1).trim();
          return question && answer ? [{ question, answer }] : [];
        }) }
      : items ? { items: JSON.parse(items) } : {}),
  };
}

async function runAction(
  formData: FormData,
  action: () => Promise<{ status: string; pageId?: string }>,
) {
  try {
    const result = await action();
    finish(result.status, result.pageId, formData);
  } catch (error) {
    const status = error instanceof AdminApiRequestError && error.status === 409
      ? 'draft-conflict'
      : error instanceof AdminApiRequestError && error.status === 400
        ? 'validation-failed'
      : error instanceof AdminApiRequestError && error.status === 401
        ? 'session-expired'
      : error instanceof AdminApiRequestError && error.status === 403
        ? 'permission-denied'
        : error instanceof AdminApiRequestError && error.status === 404
          ? 'not-found'
          : error instanceof AdminApiRequestError && error.status === 429
            ? 'rate-limited'
            : error instanceof AdminApiRequestError && error.status >= 500
              ? 'temporary-failure'
        : error instanceof Error && error.message.includes('JSON')
          ? 'invalid-content'
          : 'failed';
    finish(status, optionalValue(formData, 'pageId') ?? undefined, formData);
  }
}

function requiredValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim() || null;
}

function integerValue(formData: FormData, key: string) {
  const value = Number.parseInt(String(formData.get(key) ?? ''), 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${key} is invalid`);
  return value;
}

function nonNegativeIntegerValue(formData: FormData, key: string) {
  const value = Number.parseInt(String(formData.get(key) ?? '0'), 10);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${key} is invalid`);
  return value;
}

function slugValue(formData: FormData) {
  const slug = requiredValue(formData, 'slug').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new Error('Slug must use lowercase letters, numbers, and hyphens.');
  }
  return slug;
}

function validatePageForm(formData: FormData) {
  const errors: Record<string, string> = {};
  for (const field of ['site', 'locale', 'path', 'internalName']) {
    if (!String(formData.get(field) ?? '').trim()) errors[field] = 'This field is required.';
  }
  const path = String(formData.get('path') ?? '').trim();
  const canonicalPath = String(formData.get('canonicalPath') ?? '').trim();
  const pattern = /^\/(?:(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[(?:city|district|slug)\])(?:\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[(?:city|district|slug)\]))*)?$/u;
  if (path && !pattern.test(path)) errors.path = 'Use lowercase letters, numbers, hyphens, slashes, or supported route placeholders.';
  if (canonicalPath && !pattern.test(canonicalPath)) errors.canonicalPath = 'Canonical path must use the same valid route format.';
  return errors;
}

function validateNewsForm(formData: FormData) {
  const errors: Record<string, string> = {};
  for (const field of ['locale', 'slug', 'title', 'subtitle', 'body']) {
    if (!String(formData.get(field) ?? '').trim()) errors[field] = 'This field is required.';
  }
  const slug = String(formData.get('slug') ?? '').trim();
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    errors.slug = 'Use lowercase letters, numbers, and single hyphens only.';
  }
  return errors;
}

function validationState(fieldErrors: Record<string, string>): WebsiteContentActionState {
  return { status: 'error', error: 'Check the highlighted fields. Your entries have been preserved.', fieldErrors };
}

function websiteContentErrorState(error: unknown): WebsiteContentActionState {
  if (!(error instanceof AdminApiRequestError)) {
    return { status: 'error', error: 'The result is uncertain. Reload the page state before trying again.', retryMode: 'reload-first' };
  }
  const copy: Record<number, string> = {
    400: 'Some fields are invalid. Review the form and try again.',
    401: 'Your session expired. Sign in again; your entries remain in this form.',
    403: 'Your operator role does not permit this content action.',
    404: 'The page or Draft no longer exists. Reload before continuing.',
    409: 'This route or Draft changed. Reload and compare before submitting again.',
    429: 'Too many requests were made. Wait before submitting again.',
    500: 'The result is uncertain. Reload the page state before trying again.',
    503: 'The content service is temporarily unavailable. Reload the page state before trying again.',
  };
  return {
    status: 'error',
    error: copy[error.status] ?? (error.status >= 500 ? copy[500] : 'The request could not be completed.'),
    retryMode: error.status === 409 || error.status >= 500 ? 'reload-first' : undefined,
  };
}

function finish(status: string, pageId?: string, formData?: FormData): never {
  revalidatePath('/website-content');
  revalidatePath('/audit-log');
  const params = safeReturnParams(formData);
  params.set('status', status);
  if (pageId) params.set('pageId', pageId);
  redirect(`/website-content?${params.toString()}`);
}

function safeReturnParams(formData?: FormData) {
  const params = new URLSearchParams();
  const returnTo = formData ? optionalValue(formData, 'returnTo') : null;
  if (!returnTo) return params;
  try {
    const url = new URL(returnTo, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/website-content') return params;
    for (const key of ['view', 'site', 'locale', 'q', 'statusFilter', 'readiness', 'ownership', 'routePage', 'workspace']) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }
  } catch {
    return params;
  }
  return params;
}
