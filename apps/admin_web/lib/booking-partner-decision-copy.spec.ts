import {
  bookingPartnerDecisionLabel,
  bookingPartnerHint,
  type BookingPartnerDecisionInput,
} from './booking-partner-decision-copy';

describe('booking Partner decision copy', () => {
  it('shows the final selected Partner first', () => {
    const booking: BookingPartnerDecisionInput = {
      selectedProvider: { displayName: 'Linh Wellness' },
      preferredProvider: { displayName: 'Preferred Partner' },
      participants: [{ status: 'JOINED' }],
    };

    expect(bookingPartnerHint(booking)).toBe('Final Partner: Linh Wellness.');
  });

  it('shows first response window when there is a preferred Partner and no participants', () => {
    const booking: BookingPartnerDecisionInput = {
      preferredProvider: { displayName: 'Linh Wellness' },
      participants: [],
    };

    expect(bookingPartnerHint(booking)).toBe('Preferred Partner has first response window.');
  });

  it('shows customer decision copy when marketplace Partners are present', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [{ status: 'JOINED' }, { status: 'ACCEPTED' }],
    };

    expect(bookingPartnerHint(booking)).toBe(
      'Shortlist has Partners ready for customer decision.',
    );
  });

  it('returns preferred participant status when the preferred Partner joined', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [
        { status: 'JOINED', providerProfile: { id: 'partner-other' } },
        { status: 'ACCEPTED', providerProfile: { id: 'partner-preferred' } },
      ],
    };

    expect(bookingPartnerDecisionLabel(booking, 'partner-preferred')).toBe('ACCEPTED');
  });

  it('reads preferred participant status from providerProfileId payloads', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [
        { status: 'JOINED', providerProfileId: 'partner-preferred' },
        { status: 'ACCEPTED', providerProfileId: 'partner-marketplace' },
      ],
    };

    expect(bookingPartnerDecisionLabel(booking, 'partner-preferred')).toBe('JOINED');
  });

  it('counts marketplace-ready Partners when no preferred participant is found', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [
        { status: 'JOINED', providerProfile: { id: 'partner-a' } },
        { status: 'ACCEPTED', providerProfile: { id: 'partner-b' } },
      ],
    };

    expect(bookingPartnerDecisionLabel(booking, 'missing')).toBe('2 marketplace ready');
  });

  it('shows waiting when no Partner has responded', () => {
    expect(bookingPartnerHint({})).toBe('No Partner response yet.');
    expect(bookingPartnerDecisionLabel({}, null)).toBe('Waiting');
  });
});
