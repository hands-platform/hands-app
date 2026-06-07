import {
  bookingPartnerDecisionLabel,
  bookingPartnerHint,
  type BookingPartnerDecisionInput,
} from './booking-partner-decision-copy';

describe('booking partner decision copy', () => {
  it('shows the final selected partner first', () => {
    const booking: BookingPartnerDecisionInput = {
      selectedProvider: { displayName: 'Linh Wellness' },
      preferredProvider: { displayName: 'Preferred Partner' },
      participants: [{ status: 'JOINED' }],
    };

    expect(bookingPartnerHint(booking)).toBe('Final partner: Linh Wellness.');
  });

  it('shows first response window when there is a preferred partner and no participants', () => {
    const booking: BookingPartnerDecisionInput = {
      preferredProvider: { displayName: 'Linh Wellness' },
      participants: [],
    };

    expect(bookingPartnerHint(booking)).toBe('Preferred partner has first response window.');
  });

  it('shows customer decision copy when marketplace partners are present', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [{ status: 'JOINED' }, { status: 'ACCEPTED' }],
    };

    expect(bookingPartnerHint(booking)).toBe(
      'Shortlist has partners ready for customer decision.',
    );
  });

  it('returns preferred participant status when the preferred partner joined', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [
        { status: 'JOINED', providerProfile: { id: 'partner-other' } },
        { status: 'ACCEPTED', providerProfile: { id: 'partner-preferred' } },
      ],
    };

    expect(bookingPartnerDecisionLabel(booking, 'partner-preferred')).toBe('ACCEPTED');
  });

  it('counts marketplace-ready partners when no preferred participant is found', () => {
    const booking: BookingPartnerDecisionInput = {
      participants: [
        { status: 'JOINED', providerProfile: { id: 'partner-a' } },
        { status: 'ACCEPTED', providerProfile: { id: 'partner-b' } },
      ],
    };

    expect(bookingPartnerDecisionLabel(booking, 'missing')).toBe('2 marketplace ready');
  });

  it('shows waiting when no partner has responded', () => {
    expect(bookingPartnerHint({})).toBe('No partner response yet.');
    expect(bookingPartnerDecisionLabel({}, null)).toBe('Waiting');
  });
});
