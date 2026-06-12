import { bookingGateRejectionLaneFacts } from './booking-gate-rejection-lane-facts';

describe('bookingGateRejectionLaneFacts', () => {
  it('counts gate rejection reasons and latest age', () => {
    expect(
      bookingGateRejectionLaneFacts(
        [
          {
            createdAt: '2026-06-07T04:20:00.000Z',
            reasonCode: 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
          },
          {
            createdAt: '2026-06-07T04:10:00.000Z',
            reasonCode: 'CUSTOMER_CURRENT_LOCATION_STALE',
          },
          {
            createdAt: '2026-06-07T04:00:00.000Z',
            reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
          },
          {
            createdAt: '2026-06-07T03:50:00.000Z',
            reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
          },
        ],
        { relativeTimeLabel: (value) => `age:${value}` },
      ),
    ).toEqual({
      customerTooFarCount: 1,
      latestAge: 'age:2026-06-07T04:20:00.000Z',
      locationEvidenceCount: 2,
      partnerTooFarCount: 1,
      serviceAreaCount: 1,
      totalCount: 4,
    });
  });

  it('uses none for latest age when no logs exist', () => {
    expect(
      bookingGateRejectionLaneFacts([], { relativeTimeLabel: (value) => `age:${value}` }),
    ).toEqual({
      customerTooFarCount: 0,
      latestAge: 'none',
      locationEvidenceCount: 0,
      partnerTooFarCount: 0,
      serviceAreaCount: 0,
      totalCount: 0,
    });
  });
});
