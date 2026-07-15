'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPostOrThrow } from '../../lib/admin-api';

export async function acknowledgeBackgroundJobFailure(formData: FormData) {
  const queueName = requiredValue(formData, 'queueName');
  const jobId = requiredValue(formData, 'jobId');
  if (!queueName || !jobId) redirectWithNotice('validation');

  try {
    await adminPostOrThrow(
      `/admin/system/background-jobs/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}/acknowledge`,
      {},
    );
  } catch {
    redirectWithNotice('failed');
  }
  revalidatePath('/background-jobs');
  redirectWithNotice('acknowledged');
}

export async function resolveBackgroundJobFailure(formData: FormData) {
  const queueName = requiredValue(formData, 'queueName');
  const jobId = requiredValue(formData, 'jobId');
  const reason = requiredValue(formData, 'reason');
  if (!queueName || !jobId || !reason || reason.length < 3) redirectWithNotice('validation');

  try {
    await adminPostOrThrow(
      `/admin/system/background-jobs/${encodeURIComponent(queueName)}/${encodeURIComponent(jobId)}/resolve`,
      { reason },
    );
  } catch {
    redirectWithNotice('failed');
  }
  revalidatePath('/background-jobs');
  redirectWithNotice('resolved');
}

function requiredValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectWithNotice(notice: string): never {
  redirect(`/background-jobs?notice=${encodeURIComponent(notice)}`);
}
