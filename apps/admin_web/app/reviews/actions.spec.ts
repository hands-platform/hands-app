import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../lib/admin-api';
import { moderateReview } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatchOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('review server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatch.mockResolvedValue(undefined);
  });

  it('moderates a review with trimmed rating and copy edits', async () => {
    const formData = new FormData();
    formData.set('reviewId', ' review-1 ');
    formData.set('status', ' PUBLISHED ');
    formData.set('reportReason', '  Edited by admin  ');
    formData.set('reason', '  Corrected an admin entry  ');
    formData.set('rating', '4');
    formData.set('comment', '  Cleaner review copy.  ');
    formData.set('returnTo', '/reviews?review=published');

    await moderateReview(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/reviews/review-1/moderate',
      {
        comment: 'Cleaner review copy.',
        rating: 4,
        reason: 'Corrected an admin entry',
        reportReason: 'Edited by admin',
        status: 'PUBLISHED',
      },
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/reviews');
    expect(mockedRedirect).toHaveBeenCalledWith('/reviews?review=published&notice=updated');
  });

  it('does not send invalid review ratings to the admin API', async () => {
    const formData = new FormData();
    formData.set('reviewId', 'review-1');
    formData.set('status', 'HIDDEN');
    formData.set('rating', '6');
    formData.set('reportReason', 'Customer dispute under review');

    await moderateReview(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/reviews/review-1/moderate',
      {
        reason: 'Customer dispute under review',
        reportReason: 'Customer dispute under review',
        status: 'HIDDEN',
      },
    );
  });

  it('returns to reviews for unsafe return paths', async () => {
    const formData = new FormData();
    formData.set('reviewId', 'review-1');
    formData.set('status', 'REPORTED');
    formData.set('reportReason', 'Spam or fraudulent content');
    formData.set('returnTo', '/partners');

    await moderateReview(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/reviews?notice=needs-review');
  });

  it('reports API failure without losing the original list context', async () => {
    mockedAdminPatch.mockRejectedValueOnce(new Error('API unavailable'));
    const formData = new FormData();
    formData.set('reviewId', 'review-1');
    formData.set('status', 'HIDDEN');
    formData.set('reportReason', 'Personal information exposed');
    formData.set('returnTo', '/reviews?dateRange=30d&page=2&q=mai');

    await moderateReview(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/reviews?dateRange=30d&page=2&q=mai&notice=failed');
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
