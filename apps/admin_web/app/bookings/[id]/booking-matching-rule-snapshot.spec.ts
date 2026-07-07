import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailMatchingRuleSnapshot } from './booking-matching-rule-snapshot';
import type { bookingCustomerWaitPanel } from './booking-customer-wait-panel';
import type { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import type { bookingNotificationTrace } from './booking-notification-trace';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-matching-rule-snapshot',
    metadata: {
      matchingPolicy: {
        backupProviderRadiusMeters: 10000,
        providerResponseWindowMinutes: 10,
      },
    },
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingDetailMatchingRuleSnapshot', () => {
  it('uses operator-facing saved policy wording instead of snapshot labels', () => {
    const result = bookingDetailMatchingRuleSnapshot({
      booking: booking({}),
      customerWaitPanel: {
        signalStatus: 'Waiting for participants',
        signalTone: 'pill-info',
      } as ReturnType<typeof bookingCustomerWaitPanel>,
      marketplaceSupply: {
        eligibleCount: 2,
        radiusMeters: 10000,
      } as ReturnType<typeof bookingMarketplacePartnerSupply>,
      notificationTrace: {
        backupBatches: [{ id: 'batch-1' }],
        rows: [{ isPartnerAlert: true }],
      } as ReturnType<typeof bookingNotificationTrace>,
      walletBlocked: false,
    });

    expect(result.summary).toContain('Saved booking policy is being used');
    expect(result.rows.find((row) => row.label === 'Policy basis')).toMatchObject({
      value: 'Saved policy',
    });
    expect(JSON.stringify(result)).not.toMatch(/Saved snapshot|policy snapshot|chat archive/i);
  });
});
