import { buildCustomerManagementMetrics } from './customer-management-view-model';

type CustomerSummaryInput = Parameters<typeof buildCustomerManagementMetrics>[0];

describe('buildCustomerManagementMetrics', () => {
  it('separates customer KPI cards into today activity, risk, segments, and history', () => {
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

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          helper: 'Missing address 2 / payment issues 3',
          kind: 'risk',
          label: 'Customer attention',
          scope: 'Needs action',
          value: 5,
        }),
        expect.objectContaining({
          helper: 'Customers with enabled push devices.',
          kind: 'live',
          label: 'Push reachable',
          scope: 'Live segment',
          value: 6,
        }),
        expect.objectContaining({
          helper: 'Completed customer booking records.',
          kind: 'record',
          label: 'Booking history',
          scope: 'All records',
          value: 9,
        }),
      ]),
    );
  });
});
