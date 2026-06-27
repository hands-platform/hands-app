'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AdminNotificationTemplate } from '../../../lib/admin-api';
import { adminPatchOrThrow } from '../../../lib/admin-api';

export async function updateNotificationTemplate(formData: FormData) {
  const key = readRequiredFormString(formData, 'key');
  const locale = readRequiredFormString(formData, 'locale');
  const title = readRequiredFormString(formData, 'title');
  const body = readRequiredFormString(formData, 'body');
  const enabled = formData.get('enabled') === 'true';

  try {
    await adminPatchOrThrow<AdminNotificationTemplate>(
      `/admin/notifications/templates/${encodeURIComponent(key)}`,
      {
        locale,
        title,
        body,
        enabled,
      },
    );
    revalidatePath('/notifications/templates');
  } catch {
    redirect(`/notifications/templates?notice=failed&template=${encodeURIComponent(key)}&locale=${locale}`);
  }
  redirect(`/notifications/templates?notice=saved&template=${encodeURIComponent(key)}&locale=${locale}`);
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}
