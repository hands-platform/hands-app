'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminPatchOrThrow } from '../../../lib/admin-api';

export async function updateFinanceApproverRole(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '').trim() === 'true';
  const reason = String(formData.get('reason') ?? '').trim() || undefined;
  const returnTo = safeFinanceApproverReturnTo(
    String(formData.get('returnTo') ?? '/finance-tax/finance-approvers'),
  );

  if (!userId) {
    return redirect(appendFinanceApproverNotice(returnTo, 'invalid'));
  }

  try {
    await adminPatchOrThrow(`/admin/users/${encodeURIComponent(userId)}/finance-approver`, {
      enabled,
      reason,
    });
  } catch {
    return redirect(appendFinanceApproverNotice(returnTo, 'failed'));
  }

  revalidatePath('/finance-tax');
  revalidatePath('/finance-tax/finance-approvers');
  return redirect(appendFinanceApproverNotice(returnTo, 'updated'));
}

function safeFinanceApproverReturnTo(value: string) {
  if (!value.startsWith('/finance-tax/finance-approvers') || value.startsWith('//') || value.includes('\n')) {
    return '/finance-tax/finance-approvers';
  }

  return value;
}

function appendFinanceApproverNotice(returnTo: string, notice: string) {
  const [pathname, query = ''] = returnTo.split('?');
  const params = new URLSearchParams(query);
  params.set('roleNotice', notice);
  return `${pathname}?${params.toString()}`;
}
