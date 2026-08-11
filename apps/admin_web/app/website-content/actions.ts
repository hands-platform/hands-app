'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
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
  if (optionalValue(formData, 'confirmationId') !== pageId) {
    return finish('confirmation-required', pageId, formData);
  }
  await runAction(formData, async () => {
    await adminDeleteOrThrow(`/admin/site-pages/${pageId}`);
    return { status: 'deleted' };
  });
}

export async function createPublicSiteSection(formData: FormData) {
  const pageId = requiredValue(formData, 'pageId');
  await runAction(formData, async () => {
    await adminPostOrThrow<PublicSiteSection>(`/admin/site-pages/${pageId}/sections`, {
      key: requiredValue(formData, 'key'),
      kind: requiredValue(formData, 'kind') as PublicSiteSectionKind,
      sortOrder: nonNegativeIntegerValue(formData, 'sortOrder'),
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
      : error instanceof AdminApiRequestError && error.status === 403
        ? 'permission-denied'
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
    for (const key of ['view', 'site', 'locale', 'q', 'statusFilter', 'routePage', 'workspace']) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }
  } catch {
    return params;
  }
  return params;
}
