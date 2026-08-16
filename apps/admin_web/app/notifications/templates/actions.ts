'use server';

import { revalidatePath } from 'next/cache';

import {
  AdminApiRequestError,
  adminPatchOrThrow,
  type AdminNotificationTemplate,
} from '../../../lib/admin-api';
import type { NotificationTemplateActionState } from './notification-template-action-state';

export async function updateNotificationTemplate(
  _state: NotificationTemplateActionState,
  formData: FormData,
): Promise<NotificationTemplateActionState> {
  const key = readRequiredFormString(formData, 'key');
  try {
    const translations = readNotificationTemplateTranslations(formData);
    const saved = await adminPatchOrThrow<AdminNotificationTemplate>(
      `/admin/notifications/templates/${encodeURIComponent(key)}`,
      {
        enabled: formData.get('enabled') === 'true',
        expectedUpdatedAt: readRequiredFormString(formData, 'expectedUpdatedAt'),
        reason: readRequiredFormString(formData, 'reason'),
        ...(translations.length > 0 ? { translations } : {}),
      },
    );
    revalidatePath('/notifications/templates');
    const changed = translations.length > 0
      ? translations.map((translation) => languageName(translation.locale)).join(', ')
      : 'managed-copy setting';
    const name = saved.translations.find((translation) => translation.locale === 'en')?.title ?? 'Notification copy';
    return { message: `${name} saved · ${changed}.`, saved, status: 'saved', templateKey: key };
  } catch (error) {
    if (error instanceof AdminApiRequestError) {
      if (error.status === 409) {
        const payload = error.payload as { current?: AdminNotificationTemplate; message?: string } | undefined;
        return {
          latest: payload?.current,
          message: payload?.message ?? 'Another change was saved first. Review the latest version.',
          status: 'conflict',
          templateKey: key,
        };
      }
      if (error.status === 400) {
        return { message: apiErrorMessage(error.payload, 'Check the copy and change reason.'), status: 'validation', templateKey: key };
      }
      if (error.status === 401) {
        return { message: 'Your session expired. Copy your draft, sign in again, and review the latest version.', status: 'session-expired', templateKey: key };
      }
      if (error.status === 403) {
        return { message: 'You do not have permission to update notification copy.', status: 'forbidden', templateKey: key };
      }
      if (error.status === 404) {
        return { message: 'This managed template is missing. Reload the catalog before editing.', status: 'missing', templateKey: key };
      }
      if (error.status === 500 || error.status === 503) {
        return { message: 'The template source is unavailable. Copy your draft and load the latest version before retrying.', status: 'source-unavailable', templateKey: key };
      }
    }
    return { message: 'The update could not be saved. Your draft is still here.', status: 'server-error', templateKey: key };
  }
}

export async function updateNotificationTemplateBrowserFixture(
  fixture: 'save-failure' | 'save-success' | 'slow-save',
  _state: NotificationTemplateActionState,
  formData: FormData,
): Promise<NotificationTemplateActionState> {
  const key = readRequiredFormString(formData, 'key');
  if (
    process.env.NODE_ENV === 'production'
    || process.env.NOTIFICATION_TEMPLATE_BROWSER_FIXTURES_ENABLED !== '1'
  ) {
    return { message: 'Browser save fixtures are disabled.', status: 'server-error', templateKey: key };
  }
  await new Promise((resolve) => setTimeout(resolve, fixture === 'slow-save' ? 8_000 : 150));
  if (fixture === 'save-failure') {
    return { message: 'Fixture validation failed. Your draft is still here.', status: 'validation', templateKey: key };
  }

  const snapshot = JSON.parse(readRequiredFormString(formData, 'fixtureTemplate')) as AdminNotificationTemplate;
  const changed = readNotificationTemplateTranslations(formData);
  const updatedAt = new Date().toISOString();
  const saved: AdminNotificationTemplate = {
    ...snapshot,
    enabled: formData.get('enabled') === 'true',
    updatedAt,
    translations: snapshot.translations.map((translation) => {
      const next = changed.find((candidate) => candidate.locale === translation.locale);
      return next ? {
        ...translation,
        body: next.body,
        status: next.locale === 'en' || next.reviewedAndReady ? 'READY' : 'NEEDS_REVIEW',
        title: next.title,
        updatedAt,
      } : translation;
    }),
  };
  return { message: 'Browser fixture saved. No operating data changed.', saved, status: 'saved', templateKey: key };
}

function readNotificationTemplateTranslations(formData: FormData) {
  const value = readRequiredFormString(formData, 'translations');
  const translations = JSON.parse(value) as unknown;
  if (!Array.isArray(translations) || translations.length > 5) {
    throw new Error('translations must contain no more than five languages');
  }
  return translations.map((translation) => {
    if (!translation || typeof translation !== 'object') throw new Error('translation is invalid');
    const row = translation as Record<string, unknown>;
    const locale = typeof row.locale === 'string' ? row.locale.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (!locale || !title || !body) throw new Error('translation locale, title, and body are required');
    return {
      body,
      confirmIdenticalTranslation: row.confirmIdenticalTranslation === true,
      locale,
      reviewedAndReady: row.reviewedAndReady === true,
      title,
    };
  });
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(' ');
  return fallback;
}

function languageName(locale: string) {
  return ({ en: 'English', vi: 'Vietnamese', ko: 'Korean', ja: 'Japanese', zh: 'Chinese' } as Record<string, string>)[locale] ?? locale;
}
