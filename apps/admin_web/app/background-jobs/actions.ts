'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPostOrThrow } from '../../lib/admin-api';

export async function acknowledgeBackgroundJobFailure(formData: FormData) {
  const returnTo = backgroundJobReturnPath(formData);
  const queueName = requiredValue(formData, 'queueName');
  const jobId = requiredValue(formData, 'jobId');
  if (!queueName || !jobId) redirectWithNotice('validation', returnTo);

  try {
    await adminPostOrThrow(
      `/admin/system/background-jobs/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}/acknowledge`,
      {},
    );
  } catch {
    redirectWithNotice('failed', returnTo);
  }
  revalidatePath('/background-jobs');
  redirectWithNotice('acknowledged', returnTo);
}

export async function resolveBackgroundJobFailure(formData: FormData) {
  const returnTo = backgroundJobReturnPath(formData);
  const queueName = requiredValue(formData, 'queueName');
  const jobId = requiredValue(formData, 'jobId');
  const reason = requiredValue(formData, 'reason');
  if (!queueName || !jobId || !reason || reason.length < 3) redirectWithNotice('validation', returnTo);

  try {
    await adminPostOrThrow(
      `/admin/system/background-jobs/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}/resolve`,
      { reason },
    );
  } catch {
    redirectWithNotice('failed', returnTo);
  }
  revalidatePath('/background-jobs');
  redirectWithNotice('resolved', returnTo);
}

function requiredValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function backgroundJobReturnPath(formData: FormData) {
  const value = requiredValue(formData, 'returnTo');
  if (!value.startsWith('/') || value.startsWith('//')) return '/background-jobs';
  try {
    const url = new URL(value, 'http://admin.internal');
    return url.pathname === '/background-jobs'
      ? `${url.pathname}${url.search}`
      : '/background-jobs';
  } catch {
    return '/background-jobs';
  }
}

function redirectWithNotice(notice: string, returnTo = '/background-jobs'): never {
  const url = new URL(returnTo, 'http://admin.internal');
  url.searchParams.set('notice', notice);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
