import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { approvePostMatchCancellation, holdPostMatchCancellation } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPost: jest.fn(),
}));

const mockedAdminPost = jest.mocked(adminPost);
const mockedRevalidatePath = jest.mocked(revalidatePath);

describe('booking server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
  });

  it('approves a post-match cancellation and refreshes related admin views', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('note', 'Approved after chat evidence review.');

    await approvePostMatchCancellation(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/post-match-cancellation/approve',
      { note: 'Approved after chat evidence review.' },
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

  it('holds a post-match cancellation fee decision', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('note', 'Held after retained chat review.');

    await holdPostMatchCancellation(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/post-match-cancellation/hold',
      { note: 'Held after retained chat review.' },
      null,
    );
  });

  it('trims action form values before posting', async () => {
    const formData = new FormData();
    formData.set('bookingId', ' booking-1 ');
    formData.set('note', '  Approved inside the 15-minute window.  ');

    await approvePostMatchCancellation(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/post-match-cancellation/approve',
      { note: 'Approved inside the 15-minute window.' },
      null,
    );
  });

  it('skips the admin API when the booking id is missing', async () => {
    const formData = new FormData();
    formData.set('note', 'No booking id.');

    await approvePostMatchCancellation(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
