'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AdminNotificationTemplate } from '../../../lib/admin-api';
import { adminPatchOrThrow } from '../../../lib/admin-api';

export async function updateNotificationTemplate(formData: FormData) {
  const key = readRequiredFormString(formData, 'key');
  const locale = readRequiredFormString(formData, 'activeLocale');
  const enabled = formData.get('enabled') === 'true';

  try {
    const translations = readNotificationTemplateTranslations(formData);
    const input = {
      enabled,
      ...(translations.length > 0 ? { translations } : {}),
    };
    await adminPatchOrThrow<AdminNotificationTemplate>(
      `/admin/notifications/templates/${encodeURIComponent(key)}`,
      input,
    );
    revalidatePath('/notifications/templates');
  } catch {
    return redirect(`/notifications/templates?notice=failed&template=${encodeURIComponent(key)}&locale=${locale}`);
  }
  redirect(`/notifications/templates?notice=saved&template=${encodeURIComponent(key)}&locale=${locale}`);
}

function readNotificationTemplateTranslations(formData: FormData) {
  const value = readRequiredFormString(formData, 'translations');
  let translations: unknown;
  try {
    translations = JSON.parse(value);
  } catch {
    throw new Error('translations must be valid JSON');
  }
  if (!Array.isArray(translations) || translations.length > 5) {
    throw new Error('translations must contain no more than five languages');
  }
  return translations.map((translation) => {
    if (!translation || typeof translation !== 'object') {
      throw new Error('translation is invalid');
    }
    const row = translation as Record<string, unknown>;
    const locale = typeof row.locale === 'string' ? row.locale.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (!locale || !title || !body) {
      throw new Error('translation locale, title, and body are required');
    }
    return { body, locale, title };
  });
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}
