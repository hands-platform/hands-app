import type { AdminCustomerDirectoryRow } from '../../lib/admin-api';
import { buildCustomerRow } from './customer-list-model';
import {
  buildCustomerManagementMetrics,
  buildCustomerManagementTableRows,
} from './customer-management-view-model';

type CustomerSummaryInput = Parameters<typeof buildCustomerManagementMetrics>[0];

describe('buildCustomerManagementMetrics', () => {
  it('keeps the customer header focused on action, live bookings, and new customers', () => {
    const metrics = buildCustomerManagementMetrics({
      activeBookings: 3,
      addresses: 4,
      cancelledBookings: 2,
      capturedSpend: 500000,
      chatRooms: 1,
      completedBookings: 9,
      genderBreakdown: { female: 7, male: 2, other: 1, unknown: 0 },
      latestBookingAt: '2026-07-12T10:00:00.000Z',
      latestCompletedAt: '2026-07-12T11:00:00.000Z',
      live: 4,
      missingAddress: 2,
      needsAction: 4,
      monthSeen: 8,
      monthSeenGenderBreakdown: { female: 5, male: 2, other: 0, unknown: 1 },
      paymentIssues: 3,
      pushReachable: 6,
      recentJoins: 1,
      refundAmount: 100000,
      todayJoined: 2,
      todayJoinedGenderBreakdown: { female: 1, male: 1, other: 0, unknown: 0 },
      todaySeen: 5,
      todaySeenGenderBreakdown: { female: 4, male: 1, other: 0, unknown: 0 },
      total: 10,
    } satisfies CustomerSummaryInput);

    expect(metrics).toEqual([
      {
        helper: 'Payment, refund, or reported-review issues.',
        kind: 'risk',
        label: 'Needs attention',
        scope: 'Needs action',
        value: 4,
      },
      {
        helper: 'Matching or in service.',
        kind: 'live',
        label: 'Active booking',
        scope: 'Live',
        value: 3,
      },
      {
        helper: 'Profiles created today in Vietnam time.',
        kind: 'period',
        label: 'New today',
        scope: 'Today',
        value: 2,
      },
    ]);
  });

  it('builds compact operational cells without mixing total paid and wallet balance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T10:00:00.000Z'));

    try {
      const row = buildCustomerRow({
        activitySummary: {
          activeBookingCount: 0,
          bookingCount: 14,
          capturedSpend: 1_200_000,
          completedBookingCount: 12,
          customerClosedBookingCount: 1,
          customerWalletBalance: 200_000,
          lastBookingAt: '2026-07-15T09:00:00.000Z',
          noShowBookingCount: 1,
          paymentIssueCount: 2,
          refundRequestCount: 1,
          reportedReviewCount: 1,
        },
        bookings: [],
        id: 'customer-1',
        selectedLocationCount: 0,
        userId: 'user-1',
        user: {
          appSessions: [
            {
              active: true,
              deviceId: 'device-1',
              lastSeenAt: '2026-07-16T09:50:00.000Z',
              platform: 'ANDROID',
            },
          ],
          fullName: 'Customer One',
          phone: '+84*******00',
        },
      } as AdminCustomerDirectoryRow);

      expect(buildCustomerManagementTableRows([row], '/customers?view=all&page=2')).toEqual([
        expect.objectContaining({
          bookingStatusLabel: 'No open booking',
          detailHref: '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2',
          openSignals: [
            { label: 'Payment failed 2', tone: 'danger' },
            { label: 'Refund requests 1', tone: 'warning' },
            { label: 'Reported reviews 1', tone: 'danger' },
          ],
          historySignals: [
            { label: 'No-show 1', tone: 'neutral' },
            { label: 'Customer cancellations 1', tone: 'neutral' },
          ],
          bookingCount: 14,
          completedBookings: 12,
          customerWalletBalance: 200_000,
          totalPaid: 1_200_000,
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
