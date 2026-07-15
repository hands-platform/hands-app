'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminPatchOrThrow } from '../../../lib/admin-api';

export async function updateMonthlyTaxClosingStatus(formData: FormData) {
  const period = String(formData.get('period') || '').trim();
  const status = String(formData.get('status') || '').trim();
  const approvalAdminId = String(formData.get('approvalAdminId') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const paidAt = String(formData.get('paidAt') || '').trim();
  const remittanceChannel = String(formData.get('remittanceChannel') || '').trim();
  const remittanceEvidenceUrl = String(formData.get('remittanceEvidenceUrl') || '').trim();
  const remittanceTransferRef = String(formData.get('remittanceTransferRef') || '').trim();
  const confirmationPeriod = String(formData.get('confirmationPeriod') || '').trim();
  const confirmationStatus = String(formData.get('confirmationStatus') || '').trim();
  const returnTo = safeMonthlyTaxClosingReturnTo(
    String(formData.get('returnTo') || `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(period)}`),
    period,
  );

  if (!period || !status || confirmationPeriod !== period || confirmationStatus !== status) {
    return redirect(monthlyTaxClosingNoticeHref(returnTo, 'confirmation-required'));
  }

  try {
    await adminPatchOrThrow(
      `/admin/monthly-tax-closings/${encodeURIComponent(period)}/status`,
      {
        status,
        approvalAdminId: approvalAdminId || null,
        notes: notes || null,
        paidAt: paidAt || null,
        remittanceChannel: remittanceChannel || null,
        remittanceEvidenceUrl: remittanceEvidenceUrl || null,
        remittanceTransferRef: remittanceTransferRef || null,
      },
    );
  } catch {
    return redirect(monthlyTaxClosingNoticeHref(returnTo, 'failed'));
  }
  revalidatePath('/finance-tax');
  revalidatePath('/finance-tax/monthly-tax-closing');
  return redirect(monthlyTaxClosingNoticeHref(returnTo, 'updated'));
}

function safeMonthlyTaxClosingReturnTo(value: string, fallbackPeriod: string) {
  const fallback = monthlyTaxClosingReturnHref(fallbackPeriod, '', '');
  const url = new URL(value, 'http://localhost');
  if (url.origin !== 'http://localhost' || url.pathname !== '/finance-tax/monthly-tax-closing') {
    return fallback;
  }
  return monthlyTaxClosingReturnHref(
    url.searchParams.get('period') || fallbackPeriod,
    url.searchParams.get('take') || '',
    url.searchParams.get('page') || '',
  );
}

function monthlyTaxClosingReturnHref(period: string, take: string, page: string) {
  const search = new URLSearchParams();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) search.set('period', period);
  const parsedTake = Number(take);
  if (Number.isInteger(parsedTake) && parsedTake > 0 && parsedTake <= 100 && parsedTake !== 10) {
    search.set('take', String(parsedTake));
  }
  const parsedPage = Number(page);
  if (Number.isInteger(parsedPage) && parsedPage > 1 && parsedPage <= 1000) {
    search.set('page', String(parsedPage));
  }
  const query = search.toString();
  return `/finance-tax/monthly-tax-closing${query ? `?${query}` : ''}`;
}

function monthlyTaxClosingNoticeHref(returnTo: string, notice: string) {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('closingNotice', notice);
  return `${url.pathname}${url.search}`;
}
