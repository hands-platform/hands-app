import { BookingStatus, ParticipantStatus } from '@prisma/client';
import { openBookingWhereForProvider, providerBookingHistoryWhere } from './bookings.provider-query';

describe('booking provider query helpers', () => {
  it('builds open booking filters for customer-facing reads without provider gates', () => {
    const now = new Date('2026-06-11T00:00:00.000Z');

    expect(openBookingWhereForProvider(undefined, now)).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      expiresAt: { gt: now },
    });
  });

  it('builds open booking filters that hide provider-rejected requests', () => {
    const now = new Date('2026-06-11T00:00:00.000Z');

    expect(openBookingWhereForProvider('partner-1', now)).toEqual({
      status: BookingStatus.OPEN_MATCHING,
      expiresAt: { gt: now },
      OR: [
        {
          preferredProviderId: 'partner-1',
          participants: {
            none: {
              providerProfileId: 'partner-1',
              status: ParticipantStatus.REJECTED,
            },
          },
        },
        {
          participants: {
            none: {
              providerProfileId: 'partner-1',
              status: ParticipantStatus.REJECTED,
            },
          },
        },
      ],
    });
  });

  it('builds provider booking history filters across first-pick, selected, and participation roles', () => {
    expect(providerBookingHistoryWhere('partner-1')).toEqual({
      OR: [
        { preferredProviderId: 'partner-1' },
        { selectedProviderId: 'partner-1' },
        { participants: { some: { providerProfileId: 'partner-1' } } },
      ],
    });
  });
});
