'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch } from '../../lib/admin-api';

export async function moderateReview(formData: FormData) {
  const reviewId = String(formData.get('reviewId') || '').trim();
  const status = String(formData.get('status') || '').trim();
  const reportReason = String(formData.get('reportReason') || '').trim();
  const commentValue = formData.get('comment');
  const returnTo = safeReviewReturnTo(String(formData.get('returnTo') || '/reviews'));
  const payload: {
    status: string;
    reportReason: string;
    rating?: number;
    comment?: string;
  } = { status, reportReason };

  const rating = reviewRatingFromFormData(formData);
  if (rating !== null) {
    payload.rating = rating;
  }
  if (commentValue !== null) {
    payload.comment = String(commentValue).trim();
  }

  await adminPatch(`/admin/reviews/${reviewId}/moderate`, payload, null);
  revalidatePath('/reviews');
  redirect(returnTo);
}

function reviewRatingFromFormData(formData: FormData) {
  const ratingValue = String(formData.get('rating') || '').trim();
  const rating = Number(ratingValue);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

function safeReviewReturnTo(value: string) {
  if (!value.startsWith('/reviews') || value.startsWith('//') || value.includes('\n')) {
    return '/reviews';
  }
  return value;
}
