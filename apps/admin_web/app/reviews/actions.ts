'use server';

import { revalidatePath } from 'next/cache';
import { adminPatch } from '../../lib/admin-api';

export async function moderateReview(formData: FormData) {
  const reviewId = String(formData.get('reviewId'));
  const status = String(formData.get('status'));
  const reportReason = String(formData.get('reportReason') || '');
  const ratingValue = String(formData.get('rating') || '').trim();
  const commentValue = formData.get('comment');
  const payload: {
    status: string;
    reportReason: string;
    rating?: number;
    comment?: string;
  } = { status, reportReason };

  if (ratingValue) {
    payload.rating = Number(ratingValue);
  }
  if (commentValue !== null) {
    payload.comment = String(commentValue);
  }

  await adminPatch(`/admin/reviews/${reviewId}/moderate`, payload, null);
  revalidatePath('/reviews');
}
