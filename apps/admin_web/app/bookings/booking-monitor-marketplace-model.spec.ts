import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMonitorMarketplaceCoverageRows,
  buildBookingMonitorMarketplaceOperatingQueue,
  buildBookingMonitorMarketplaceOperationsCards,
  buildBookingMonitorMarketplacePanelModel,
  buildBookingMonitorMarketplaceParticipantLedgerRows,
} from './booking-monitor-marketplace-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('booking monitor marketplace model', () => {
  it('returns empty rows and zeroed cards when no bookings are visible', () => {
    const ledgerRows = buildBookingMonitorMarketplaceParticipantLedgerRows([], nowMs, 10_000);

    expect(buildBookingMonitorMarketplaceCoverageRows([], nowMs)).toEqual([]);
    expect(ledgerRows).toEqual([]);
    expect(buildBookingMonitorMarketplaceOperatingQueue([], nowMs).map((item) => item.value)).toEqual([
      '0 waiting',
      '0 with participant records',
      '0 waiting',
      '0 repair',
      '0 blocked',
    ]);
    expect(
      buildBookingMonitorMarketplaceOperationsCards([], ledgerRows, nowMs).map((card) => [
        card.title,
        card.value,
      ]),
    ).toEqual([
      ['Open marketplace', '0'],
      ['Customer choice', '0'],
      ['No participant supply', '0'],
      ['Alert delivery missing', '0'],
      ['Selected Partners', '0'],
      ['Cash fee debt', '0'],
    ]);
  });

  it('flags open matching bookings with no marketplace supply in the operating queue', () => {
    const queue = buildBookingMonitorMarketplaceOperatingQueue(
      [
        {
          id: 'open-no-supply',
          matchingEvidence: {
            marketplaceParticipantCount: 0,
            selectableParticipantCount: 0,
          },
          status: 'OPEN_MATCHING',
        } as AdminBooking,
      ],
      nowMs,
    );

    expect(queue[1]).toMatchObject({
      status: 'Supply gap',
      title: 'Partner participation pool',
      value: '0 with participant records',
    });
    expect(queue[1].bookings.map((booking) => booking.id)).toEqual(['open-no-supply']);
  });

  it('builds the marketplace panel model from visible and ordered booking sets', () => {
    const model = buildBookingMonitorMarketplacePanelModel({
      marketplaceRadiusMeters: 10_000,
      nowMs,
      orderedBookings: [],
      visibleBookings: [],
    });

    expect(model.marketplaceBookingCoverageRows).toEqual([]);
    expect(model.marketplaceLedgerRows).toEqual([]);
    expect(model.marketplaceBookingCoverageSummary).toMatchObject({ total: 0 });
    expect(model.marketplaceLedgerSummary).toMatchObject({ total: 0 });
    expect(model.marketplaceOperatingQueue.map((item) => item.value)).toEqual([
      '0 waiting',
      '0 with participant records',
      '0 waiting',
      '0 repair',
      '0 blocked',
    ]);
  });
});
