import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorListMarketplaceParticipantOverflowCount,
  bookingMonitorListMarketplaceParticipants,
  bookingMonitorListSelectedFinalPartnerPillLabel,
} from './booking-monitor-list-marketplace';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

function participant(
  id: string,
  displayName: string | null,
  status = 'JOINED',
): BookingParticipant {
  return {
    id,
    providerProfile: { displayName },
    status,
  } as BookingParticipant;
}

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking monitor list marketplace helpers', () => {
  it('maps visible marketplace participant pills and overflow count', () => {
    const participants = [
      participant('one', 'One', 'JOINED'),
      participant('two', 'Two', 'ACCEPTED'),
      participant('three', 'Three'),
      participant('four', 'Four'),
      participant('five', 'Five'),
    ];

    expect(bookingMonitorListMarketplaceParticipantOverflowCount(participants)).toBe(1);
    expect(bookingMonitorListMarketplaceParticipants(participants)).toEqual([
      { id: 'one', partnerLabel: 'One', status: 'JOINED' },
      { id: 'two', partnerLabel: 'Two', status: 'ACCEPTED' },
      { id: 'three', partnerLabel: 'Three', status: 'JOINED' },
      { id: 'four', partnerLabel: 'Four', status: 'JOINED' },
    ]);
  });

  it('shows the selected final partner only when it differs from first pick', () => {
    expect(bookingMonitorListSelectedFinalPartnerPillLabel(booking({}))).toBeNull();
    expect(
      bookingMonitorListSelectedFinalPartnerPillLabel(
        booking({
          preferredProvider: { id: 'preferred', displayName: 'First Pick' },
          selectedProvider: { id: 'preferred', displayName: 'First Pick' },
        } as Partial<AdminBooking>),
      ),
    ).toBeNull();
    expect(
      bookingMonitorListSelectedFinalPartnerPillLabel(
        booking({
          preferredProvider: { id: 'preferred', displayName: 'First Pick' },
          selectedProvider: { id: 'selected', displayName: 'Selected Partner' },
        } as Partial<AdminBooking>),
      ),
    ).toBe('Selected Partner');
  });
});
