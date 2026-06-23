import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch } from '../../lib/admin-api';
import { moderateReview } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPatch: jest.fn(),
}));

const mockedAdminPatch = jest.mocked(adminPatch);
const mockedRedirect = jest.mocked(redirect);
const mockedRevalidatePath = jest.mocked(revalidatePath);

describe('review server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAdminPatch.mockResolvedValue(undefined);
  });

  it('moderates a review with trimmed rating and copy edits', async () => {
    const formData = new FormData();
    formData.set('reviewId', ' review-1 ');
    formData.set('status', ' PUBLISHED ');
    formData.set('reportReason', '  Edited by admin  ');
    formData.set('rating', '4');
    formData.set('comment', '  Cleaner review copy.  ');
    formData.set('returnTo', '/reviews?review=published');

    await moderateReview(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/reviews/review-1/moderate',
      {
        comment: 'Cleaner review copy.',
        rating: 4,
        reportReason: 'Edited by admin',
        status: 'PUBLISHED',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/reviews');
    expect(mockedRedirect).toHaveBeenCalledWith('/reviews?review=published');
  });

  it('does not send invalid review ratings to the admin API', async () => {
    const formData = new FormData();
    formData.set('reviewId', 'review-1');
    formData.set('status', 'HIDDEN');
    formData.set('rating', '6');
    formData.set('comment', 'Held review copy.');

    await moderateReview(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/reviews/review-1/moderate',
      {
        comment: 'Held review copy.',
        reportReason: '',
        status: 'HIDDEN',
      },
      null,
    );
  });

  it('returns to reviews for unsafe return paths', async () => {
    const formData = new FormData();
    formData.set('reviewId', 'review-1');
    formData.set('status', 'REPORTED');
    formData.set('returnTo', '/partners');

    await moderateReview(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/reviews');
  });
});
