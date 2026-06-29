'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminPatch } from '../../../lib/admin-api';

export async function updateMonthlyTaxClosingStatus(formData: FormData) {
  const period = String(formData.get('period') || '').trim();
  const status = String(formData.get('status') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const returnTo = safeMonthlyTaxClosingReturnTo(
    String(formData.get('returnTo') || `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(period)}`),
  );

  if (!period || !status) {
    redirect(returnTo);
  }

  await adminPatch(
    `/admin/monthly-tax-closings/${encodeURIComponent(period)}/status`,
    {
      status,
      notes: notes || null,
    },
    null,
  );
  revalidatePath('/finance-tax');
  revalidatePath('/finance-tax/monthly-tax-closing');
  redirect(returnTo);
}

function safeMonthlyTaxClosingReturnTo(value: string) {
  if (!value.startsWith('/finance-tax/monthly-tax-closing') || value.startsWith('//') || value.includes('\n')) {
    return '/finance-tax/monthly-tax-closing';
  }

  return value;
}
