'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../lib/admin-api';
import { safeReviewReturnTo } from './review-action-confirmation';

export async function moderateReview(formData: FormData) {
  const reviewId = String(formData.get('reviewId') || '').trim();
  const status = String(formData.get('status') || '').trim();
  const reportReason = String(formData.get('reportReason') || '').trim();
  const commentValue = formData.get('comment');
  const returnTo = safeReviewReturnTo(String(formData.get('returnTo') || '/reviews'));
  const reason = String(formData.get('reason') || reportReason).trim();
  const payload: {
    status: string;
    reportReason: string;
    reason: string;
    rating?: number;
    comment?: string;
  } = { status, reportReason, reason };

  const rating = reviewRatingFromFormData(formData);
  if (rating !== null) {
    payload.rating = rating;
  }
  if (commentValue !== null) {
    payload.comment = String(commentValue).trim();
  }

  if (!reviewId || !['HIDDEN', 'PUBLISHED', 'REPORTED'].includes(status)) {
    redirect(reviewNoticeHref(returnTo, 'failed'));
    return;
  }

  try {
    await adminPatchOrThrow(`/admin/reviews/${encodeURIComponent(reviewId)}/moderate`, payload);
  } catch {
    redirect(reviewNoticeHref(returnTo, 'failed'));
    return;
  }
  revalidatePath('/reviews');
  const notice = commentValue !== null || rating !== null
    ? 'updated'
    : status === 'PUBLISHED'
      ? 'published'
      : status === 'HIDDEN'
        ? 'hidden'
        : 'needs-review';
  redirect(reviewNoticeHref(returnTo, notice));
}

function reviewRatingFromFormData(formData: FormData) {
  const ratingValue = String(formData.get('rating') || '').trim();
  const rating = Number(ratingValue);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

function reviewNoticeHref(returnTo: string, notice: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}${url.hash}`;
}
