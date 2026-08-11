'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../../lib/admin-api';
import { safePartnerNoteReturnTo } from '../partner-customer-note-action-confirmation';

export async function moderatePartnerCustomerNote(formData: FormData) {
  const noteId = String(formData.get('noteId') || '').trim();
  const status = String(formData.get('status') || '').trim();
  const reason = String(formData.get('reason') || '').trim();
  const returnTo = safePartnerNoteReturnTo(
    String(formData.get('returnTo') || '/reviews/partner-customer-evaluations'),
  );

  if (
    !noteId ||
    !['HIDDEN', 'PUBLISHED', 'REPORTED'].includes(status) ||
    (status !== 'PUBLISHED' && !reason)
  ) {
    redirect(partnerNoteNoticeHref(returnTo, 'failed'));
    return;
  }

  try {
    await adminPatchOrThrow(`/admin/partner-customer-reviews/${encodeURIComponent(noteId)}/moderate`, {
      reason,
      status,
    });
  } catch {
    redirect(partnerNoteNoticeHref(returnTo, 'failed'));
    return;
  }

  revalidatePath('/reviews/partner-customer-evaluations');
  redirect(
    partnerNoteNoticeHref(
      returnTo,
      status === 'PUBLISHED' ? 'retained' : status === 'REPORTED' ? 'needs-review' : 'restricted',
    ),
  );
}

function partnerNoteNoticeHref(returnTo: string, notice: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}
