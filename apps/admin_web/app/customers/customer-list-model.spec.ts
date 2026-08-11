import type { AdminBooking, AdminCustomerDirectoryRow } from '../../lib/admin-api';
import { buildCustomerRow, buildServerCustomerPagination } from './customer-list-model';

function booking(input: Partial<AdminBooking> & { id: string }): AdminBooking {
  return {
    status: 'CREATED',
    ...input,
  } as AdminBooking;
}

function customer(input: Partial<AdminCustomerDirectoryRow> = {}): AdminCustomerDirectoryRow {
  return {
    id: 'customer-001',
    selectedLocationCount: 0,
    userId: 'user-001',
    user: { id: 'user-001', phone: '+84******89', roles: ['CUSTOMER'] },
    ...input,
  } as AdminCustomerDirectoryRow;
}

function appSession(deviceLanguage: string) {
  return {
    active: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    deviceId: `device-${deviceLanguage}`,
    deviceLanguage,
    id: `session-${deviceLanguage}`,
    lastSeenAt: '2026-06-01T00:00:00.000Z',
    role: 'CUSTOMER',
    updatedAt: '2026-06-01T00:00:00.000Z',
    userId: 'user-001',
  };
}

describe('customer list model', () => {
  it('keeps an unnamed customer label separate from the server-masked phone', () => {
    const row = buildCustomerRow(customer({ user: { fullName: null, phone: '+84******89' } }));

    expect(row.name).toBe('Unnamed customer');
    expect(row.phone).toBe('+84******89');
  });

  it('normalizes bare and regional app locales to their base language', () => {
    expect(
      buildCustomerRow(customer({ user: { appSessions: [appSession('zh-CN')] } })).deviceLanguageCountryCode,
    ).toBe('ZH');
    expect(
      buildCustomerRow(customer({ user: { appSessions: [appSession('en')] } })).deviceLanguageCountryCode,
    ).toBe('EN');
    expect(
      buildCustomerRow(customer({ user: { appSessions: [appSession('vi_VN')] } })).deviceLanguageCountryCode,
    ).toBe('VI');
  });

  it('prefers server-computed activity summary when list booking rows are capped', () => {
    const row = buildCustomerRow(
      customer({
        activitySummary: {
          activeBookingCount: 7,
          adminClosedBookingCount: 2,
          bookingCount: 44,
          capturedSpend: 2_400_000,
          closedBookingCount: 6,
          completedBookingCount: 19,
          customerWalletBalance: 350_000,
          customerClosedBookingCount: 1,
          currentBookingUpdatedAt: '2026-06-20T11:30:00.000Z',
          lastBookingAt: '2026-06-20T12:00:00.000Z',
          lastCompletedBookingAt: '2026-06-19T10:00:00.000Z',
          noShowBookingCount: 3,
          openMatchingBookingCount: 2,
          partnerClosedBookingCount: 3,
          paymentIssueCount: 2,
          refundRequestCount: 1,
          reportedReviewCount: 4,
          serviceLiveBookingCount: 1,
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
    expect(row.activeBookings).toBe(7);
    expect(row.openMatchingBookings).toBe(2);
    expect(row.serviceLiveBookings).toBe(1);
    expect(row.currentBookingUpdatedAt).toBe('2026-06-20T11:30:00.000Z');
    expect(row.cancelledBookings).toBe(6);
    expect(row.completedBookings).toBe(19);
    expect(row.customerClosedBookings).toBe(1);
    expect(row.adminClosedBookings).toBe(2);
    expect(row.partnerClosedBookings).toBe(3);
    expect(row.noShowBookings).toBe(3);
    expect(row.capturedSpend).toBe(2_400_000);
    expect(row.customerWalletBalance).toBe(350_000);
    expect(row.paymentIssues).toBe(2);
    expect(row.refundRequests).toBe(1);
    expect(row.reportedReviews).toBe(4);
    expect(row.lastBookingAt).toBe('2026-06-20T12:00:00.000Z');
    expect(row.lastCompletedAt).toBe('2026-06-19T10:00:00.000Z');
  });

  it('uses server-provided customer rows without slicing them again', () => {
    const pagination = buildServerCustomerPagination(
      [{ id: 'customer-11' }, { id: 'customer-12' }],
      {
        country: '',
        dateField: 'last-login',
        dateFrom: '',
        dateRange: '',
        dateTo: '',
        gender: '',
        page: 2,
        pageSize: 10,
        q: '',
        segment: '',
        sort: 'newest',
        view: 'needs-action',
      },
      12,
    );

    expect(pagination.rows).toEqual([{ id: 'customer-11' }, { id: 'customer-12' }]);
    expect(pagination.from).toBe(11);
    expect(pagination.to).toBe(12);
    expect(pagination.totalRows).toBe(12);
  });

  it('uses the clamped page when calculating server pagination labels', () => {
    const pagination = buildServerCustomerPagination(
      Array.from({ length: 5 }, (_, index) => ({ id: `customer-${index + 31}` })),
      {
        country: '',
        dateField: 'last-login',
        dateFrom: '',
        dateRange: '',
        dateTo: '',
        gender: '',
        page: 99,
        pageSize: 10,
        q: '',
        segment: '',
        sort: 'newest',
        view: 'all',
      },
      35,
    );

    expect(pagination).toEqual(expect.objectContaining({ from: 31, page: 4, to: 35, totalPages: 4 }));
  });
});
