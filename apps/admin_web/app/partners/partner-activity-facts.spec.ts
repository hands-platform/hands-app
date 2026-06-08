import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import {
  latestPartnerBookingRecord,
  partnerAvailablePayout,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerGrossRevenue,
  partnerLastActivityAt,
  partnerLastCompletedWorkAt,
  partnerLastSessionAt,
  partnerPendingPayout,
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';

function booking(input: Partial<AdminBooking> & { id: string }): AdminBooking {
  return {
    status: 'CREATED',
    ...input,
  } as AdminBooking;
}

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    ...input,
  } as AdminProvider;
}

describe('partner activity facts', () => {
  it('deduplicates preferred, selected, and participant booking rows by booking id', () => {
    const sharedBooking = booking({ id: 'booking-shared', updatedAt: '2026-05-21T10:00:00.000Z' });
    const selectedBooking = booking({ id: 'booking-selected', updatedAt: '2026-05-21T11:00:00.000Z' });
    const participantBooking = booking({ id: 'booking-participant', updatedAt: '2026-05-21T12:00:00.000Z' });

    const rows = partnerBookingRows(
      partner({
        preferredBookings: [sharedBooking],
        selectedBookings: [sharedBooking, selectedBooking],
        participants: [
          { id: 'participant-1', status: 'JOINED', booking: sharedBooking },
          { id: 'participant-2', status: 'JOINED', booking: participantBooking },
        ],
      }),
    );

    expect(rows.map((row) => row.id)).toEqual(['booking-shared', 'booking-selected', 'booking-participant']);
  });

  it('returns the latest booking record by operational activity time', () => {
    const rows = [
      booking({ id: 'old-booking', updatedAt: '2026-05-20T08:00:00.000Z' }),
      booking({ id: 'latest-booking', updatedAt: '2026-05-21T08:00:00.000Z' }),
      booking({ id: 'created-only-booking', createdAt: '2026-05-19T08:00:00.000Z' }),
    ];

    expect(latestPartnerBookingRecord(rows)?.id).toBe('latest-booking');
  });

  it('summarizes factual earnings for operations', () => {
    const result = partner({
      earnings: [
        {
          id: 'earning-pending',
          providerProfileId: 'partner-001',
          bookingId: 'booking-1',
          grossAmount: 500000,
          platformFee: 120000,
          withholdingAmount: 0,
          netAmount: 380000,
          currency: 'VND',
          status: 'PENDING',
          createdAt: '2026-05-21T08:00:00.000Z',
        },
        {
          id: 'earning-available',
          providerProfileId: 'partner-001',
          bookingId: 'booking-2',
          grossAmount: 600000,
          platformFee: 150000,
          withholdingAmount: 0,
          netAmount: 450000,
          currency: 'VND',
          status: 'AVAILABLE',
          availableAt: '2026-05-22T08:00:00.000Z',
          createdAt: '2026-05-22T07:00:00.000Z',
        },
        {
          id: 'earning-paid',
          providerProfileId: 'partner-001',
          bookingId: 'booking-3',
          grossAmount: 700000,
          platformFee: 200000,
          withholdingAmount: 0,
          netAmount: 500000,
          currency: 'VND',
          status: 'PAID',
          paidAt: '2026-05-23T08:00:00.000Z',
          payoutBatchId: 'batch-1',
          createdAt: '2026-05-23T07:00:00.000Z',
          booking: { status: 'COMPLETED', updatedAt: '2026-05-23T09:00:00.000Z' },
        } as never,
      ],
    });

    expect(partnerCompletedWorkCount(result)).toBe(2);
    expect(partnerGrossRevenue(result)).toBe(1800000);
    expect(partnerPendingPayout(result)).toBe(830000);
    expect(partnerAvailablePayout(result)).toBe(450000);
    expect(partnerLastCompletedWorkAt(result)).toBe('2026-05-23T09:00:00.000Z');
  });

  it('calculates unsettled wallet balance from pending and available unbatched earnings only', () => {
    const result = partner({
      earnings: [
        {
          id: 'cash-fee-debt',
          providerProfileId: 'partner-001',
          bookingId: 'booking-cash',
          grossAmount: 500000,
          platformFee: 120000,
          withholdingAmount: 0,
          netAmount: '-120000',
          currency: 'VND',
          status: 'PENDING',
        } as never,
        {
          id: 'batched-earning',
          providerProfileId: 'partner-001',
          bookingId: 'booking-batched',
          grossAmount: 500000,
          platformFee: 120000,
          withholdingAmount: 0,
          netAmount: 380000,
          currency: 'VND',
          status: 'AVAILABLE',
          payoutBatchId: 'batch-1',
        },
        {
          id: 'paid-earning',
          providerProfileId: 'partner-001',
          bookingId: 'booking-paid',
          grossAmount: 500000,
          platformFee: 120000,
          withholdingAmount: 0,
          netAmount: 380000,
          currency: 'VND',
          status: 'PAID',
        },
      ],
    });

    expect(partnerUnsettledWalletBalance(result)).toBe(-120000);
  });

  it('returns latest factual app activity and session timestamps', () => {
    const result = partner({
      currentLocationUpdatedAt: '2026-05-22T07:00:00.000Z',
      nextAvailableAt: '2026-05-22T08:00:00.000Z',
      sessions: [
        {
          id: 'session-1',
          lastSeenAt: '2026-05-22T09:00:00.000Z',
          loggedInAt: '2026-05-22T06:00:00.000Z',
          suspicious: false,
        },
      ],
      devices: [
        {
          id: 'device-1',
          deviceId: 'device',
          platform: 'android',
          enabled: true,
          lastSeenAt: '2026-05-22T10:00:00.000Z',
          updatedAt: '2026-05-22T05:00:00.000Z',
        },
      ],
      user: {
        id: 'user-1',
        phone: '+84900000000',
        pushDevices: [{ id: 'push-1', platform: 'android', enabled: true, createdAt: '2026-05-22T11:00:00.000Z' }],
      },
    });

    expect(partnerLastActivityAt(result)).toBe('2026-05-22T11:00:00.000Z');
    expect(partnerLastSessionAt(result)).toBe('2026-05-22T10:00:00.000Z');
  });
});
