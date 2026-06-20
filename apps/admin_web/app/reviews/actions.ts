'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch } from '../../lib/admin-api';

export async function moderateReview(formData: FormData) {
  const reviewId = String(formData.get('reviewId'));
  const status = String(formData.get('status'));
  const reportReason = String(formData.get('reportReason') || '');
  const ratingValue = String(formData.get('rating') || '').trim();
  const commentValue = formData.get('comment');
  const returnTo = safeReviewReturnTo(String(formData.get('returnTo') || '/reviews'));
  const payload: {
    status: string;
    reportReason: string;
    rating?: number;
    comment?: string;
  } = { status, reportReason };

  const rating = Number(ratingValue);
  if (Number.isFinite(rating)) {
    payload.rating = rating;
  }
  if (commentValue !== null) {
    payload.comment = String(commentValue);
  }

  await adminPatch(`/admin/reviews/${reviewId}/moderate`, payload, null);
  revalidatePath('/reviews');
  redirect(returnTo);
}

function safeReviewReturnTo(value: string) {
  if (!value.startsWith('/reviews') || value.startsWith('//') || value.includes('\n')) {
    return '/reviews';
  }
  return value;
}
