import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingParticipantCounts } from './booking-participant-counts';

type BookingParticipant = NonNullable<AdminBookingDetail['participants']>[number];

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function participant(input: Partial<BookingParticipant>): BookingParticipant {
  return input as BookingParticipant;
}

describe('booking participant counts', () => {
  it('separates first-pick rows from marketplace evidence rows', () => {
    const counts = bookingParticipantCounts(
      booking({
        preferredProviderId: 'partner-first',
        participants: [
          participant({
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'JOINED',
          }),
          participant({
            id: 'participant-marketplace',
            providerProfileId: 'partner-marketplace',
            status: 'JOINED',
          }),
          participant({
            id: 'participant-rejected',
            providerProfileId: 'partner-rejected',
            status: 'REJECTED',
          }),
        ],
      }),
    );

    expect(counts).toEqual({
      firstPick: 1,
      marketplace: 2,
      total: 3,
    });
  });

  it('treats every participant row as marketplace when no preferred Partner exists', () => {
    const counts = bookingParticipantCounts(
      booking({
        participants: [
          participant({ id: 'participant-a', providerProfileId: 'partner-a', status: 'JOINED' }),
          participant({ id: 'participant-b', providerProfileId: 'partner-b', status: 'ACCEPTED' }),
        ],
      }),
    );

    expect(counts).toEqual({
      firstPick: 0,
      marketplace: 2,
      total: 2,
    });
  });
});
