import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { AdminApiRequestError, adminPost, adminPostOrThrow } from '../../../lib/admin-api';
import {
  addBookingOpsNote,
  expireBooking,
  refundBookingPayment,
  resolvePostMatchCancellationFromDetail,
  updateBookingOpsTask,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { mockedRedirect } = vi.hoisted(() => ({
  mockedRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockedRedirect,
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return {
    ...actual,
    adminPost: vi.fn(),
    adminPostOrThrow: vi.fn(),
  };
});

const mockedAdminPost = vi.mocked(adminPost);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('booking detail server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
    mockedAdminPost.mockClear();
    mockedAdminPostOrThrow.mockClear();
    mockedRevalidatePath.mockClear();
    mockedRedirect.mockClear();
  });

  it('redirects with success feedback after saving a structured operator note', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('note', ' Customer called. ');

    await expect(addBookingOpsNote(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/bookings/booking-1/ops-note', {
      note: 'Customer called.',
      preset: '',
    });
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/bookings/booking-1?notice=note-saved#operator-notes',
    );
  });

  it('shows failure feedback when expiry is rejected by the API guard', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('Booking is not eligible for expiry'));
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('reason', 'Deadline passed.');

    await expect(expireBooking(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/bookings/booking-1?notice=expiry-failed#matching-expiry',
    );
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('creates a refund request and leaves execution to Finance Approval Queue', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('paymentId', 'payment-1');

    await refundBookingPayment(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payments/payment-1/refund-request',
      {},
    );
    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
  });

  it.each([
    ['approve', '/admin/bookings/booking-1/post-match-cancellation/approve'],
    ['hold', '/admin/bookings/booking-1/post-match-cancellation/hold'],
  ])('resolves the shared decision form with %s', async (decision, href) => {
    mockedAdminPostOrThrow.mockResolvedValueOnce({
      postMatchDecisionResult: {
        decision: decision === 'hold' ? 'HELD' : 'APPROVED',
        earningResult: { skipped: decision === 'hold' },
        paymentResolution: { released: true },
      },
    });
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', decision);
    formData.set('reason', 'CUSTOMER_REQUESTED');
    formData.set('note', 'Reviewed retained evidence.');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      href,
      { note: 'Reviewed retained evidence.', reason: 'CUSTOMER_REQUESTED' },
    );
    expect(result.status).toBe('success');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/bookings/post-match-cancellations');
  });

  it('rejects an unknown shared cancellation decision', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', 'delete');
    formData.set('reason', 'CUSTOMER_REQUESTED');
    formData.set('note', 'Invalid action.');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(result).toMatchObject({ status: 'error' });
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('requires a note when Other is selected', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', 'approve');
    formData.set('reason', 'OTHER');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(result.message).toBe('Add an operator note when Other is selected.');
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('reports a concurrent decision without recording local success', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/bookings/booking-1/post-match-cancellation/approve', 409),
    );
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', 'approve');
    formData.set('reason', 'CUSTOMER_REQUESTED');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(result.message).toBe('Another operator already resolved this review. Refresh to see the result.');
    expect(result.status).toBe('error');
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('shows the API validation message without recording local success', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/bookings/booking-1/post-match-cancellation/hold', 422, {
        message: ['No active Partner fee deduction exists to keep'],
      }),
    );
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', 'hold');
    formData.set('reason', 'CUSTOMER_REQUESTED');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(result.message).toBe('No active Partner fee deduction exists to keep');
    expect(result.status).toBe('error');
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('keeps the decision form retryable when the API is unavailable', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('Network unavailable'));
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('decision', 'approve');
    formData.set('reason', 'CUSTOMER_REQUESTED');
    formData.set('note', 'Evidence checked.');

    const result = await resolvePostMatchCancellationFromDetail(null, formData);

    expect(result).toMatchObject({
      message: 'The cancellation decision could not be saved. No success was recorded; refresh and try again.',
      status: 'error',
      values: { decision: 'approve', note: 'Evidence checked.', reason: 'CUSTOMER_REQUESTED' },
    });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each(['BLOCKED', 'PENDING'])('does not submit %s operation tasks without a reason', async (status) => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('type', 'CUSTOMER_CONTACTED');
    formData.set('status', status);
    formData.set('note', '   ');

    await updateBookingOpsTask(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
  });

  it('does not block a checkpoint without a next check time', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('type', 'CUSTOMER_CONTACTED');
    formData.set('status', 'BLOCKED');
    formData.set('note', 'Customer did not answer.');

    await updateBookingOpsTask(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
  });

  it('retains the blocked reason and next check time in the audit note', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('type', 'CUSTOMER_CONTACTED');
    formData.set('status', 'BLOCKED');
    formData.set('note', ' Customer did not answer. ');
    formData.set('nextCheckAt', '2026-08-05T14:30');

    await updateBookingOpsTask(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/ops-task',
      {
        note: 'Customer did not answer.\nNext check: 2026-08-05T14:30',
        status: 'BLOCKED',
        type: 'CUSTOMER_CONTACTED',
      },
      null,
    );
  });

  it('submits a trimmed reason when reopening a completed checkpoint', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('type', 'LOCATION_CHECKED');
    formData.set('status', 'PENDING');
    formData.set('note', '  Customer changed the address.  ');

    await updateBookingOpsTask(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/bookings/booking-1/ops-task',
      {
        note: 'Customer changed the address.',
        status: 'PENDING',
        type: 'LOCATION_CHECKED',
      },
      null,
    );
  });
});
