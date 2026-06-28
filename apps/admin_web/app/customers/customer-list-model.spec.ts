import type { AdminBooking, AdminCustomer } from '../../lib/admin-api';
import { buildCustomerRow, buildServerCustomerPagination } from './customer-list-model';

function booking(input: Partial<AdminBooking> & { id: string }): AdminBooking {
  return {
    status: 'CREATED',
    ...input,
  } as AdminBooking;
}

function customer(input: Partial<AdminCustomer> = {}): AdminCustomer {
  return {
    id: 'customer-001',
    userId: 'user-001',
    user: { id: 'user-001', phone: '+84123456789', roles: ['CUSTOMER'] },
    ...input,
  } as AdminCustomer;
}

describe('customer list model', () => {
  it('prefers server-computed activity summary when list booking rows are capped', () => {
    const row = buildCustomerRow(
      customer({
        activitySummary: {
          bookingCount: 44,
          completedBookingCount: 19,
          lastBookingAt: '2026-06-20T12:00:00.000Z',
          lastCompletedBookingAt: '2026-06-19T10:00:00.000Z',
        },
        bookings: [
          booking({
            id: 'recent-created-only',
            status: 'CREATED',
            updatedAt: '2026-06-18T10:00:00.000Z',
          }),
        ],
      }),
    );

    expect(row.bookingCount).toBe(44);
    expect(row.completedBookings).toBe(19);
    expect(row.lastBookingAt).toBe('2026-06-20T12:00:00.000Z');
    expect(row.lastCompletedAt).toBe('2026-06-19T10:00:00.000Z');
  });

  it('uses server-provided customer rows without slicing them again', () => {
    const pagination = buildServerCustomerPagination(
      [{ id: 'customer-11' }, { id: 'customer-12' }],
      {
        country: '',
        gender: '',
        joinedFrom: '',
        joinedRange: '',
        joinedTo: '',
        lastBookingFrom: '',
        lastBookingRange: '',
        lastBookingTo: '',
        lastLoginFrom: '',
        lastLoginRange: '',
        lastLoginTo: '',
        page: 2,
        pageSize: 10,
        q: '',
        sort: 'last-booking',
      },
      12,
    );

    expect(pagination.rows).toEqual([{ id: 'customer-11' }, { id: 'customer-12' }]);
    expect(pagination.from).toBe(11);
    expect(pagination.to).toBe(12);
    expect(pagination.totalRows).toBe(12);
  });
});
