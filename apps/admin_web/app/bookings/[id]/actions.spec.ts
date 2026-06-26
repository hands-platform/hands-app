import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { adminPost } from '../../../lib/admin-api';
import {
  approvePostMatchCancellationFromDetail,
  holdPostMatchCancellationFromDetail,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../../lib/admin-api', () => ({
  adminPost: vi.fn(),
}));

const mockedAdminPost = vi.mocked(adminPost);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('booking detail server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPost.mockClear();
    mockedRevalidatePath.mockClear();
  });

  it('approves post-match cancellation from the booking detail page', async () => {
    const formData = new FormData();
    formData.set('bookingId', ' booking-1 ');
    formData.set('note', '  Approved after detail chat review.  ');

    await approvePostMatchCancellationFromDetail(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/post-match-cancellation/approve',
      { note: 'Approved after detail chat review.' },
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/bookings/booking-1',
      '/bookings',
      '/earnings',
      '/cash-settlements',
      '/partner-controls',
      '/partners',
      '/operations-handoff',
      '/audit-log',
    ]);
  });

  it('holds the partner fee deduction from the booking detail page', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('note', 'Held after detail evidence review.');

    await holdPostMatchCancellationFromDetail(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/post-match-cancellation/hold',
      { note: 'Held after detail evidence review.' },
      null,
    );
  });

  it('skips post-match cancellation decisions without a booking id', async () => {
    const formData = new FormData();
    formData.set('note', 'Missing booking.');

    await approvePostMatchCancellationFromDetail(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
