import {
  bookingParticipantPartnerId,
  isCustomerSelectableBookingParticipant,
} from './booking-participant-choice';

describe('booking participant customer choice policy', () => {
  it('allows accepted and selected rows regardless of first-pick role', () => {
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'ACCEPTED', providerProfileId: 'partner-first' },
        'partner-first',
      ),
    ).toBe(true);
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'SELECTED', providerProfile: { id: 'partner-marketplace' } },
        'partner-first',
      ),
    ).toBe(true);
  });

  it('keeps pending first-pick participation as evidence-only until acceptance', () => {
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'JOINED', providerProfileId: 'partner-first' },
        'partner-first',
      ),
    ).toBe(false);
  });

  it('allows joined marketplace partners to appear in the customer choice list', () => {
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'JOINED', providerProfile: { id: 'partner-marketplace' } },
        'partner-first',
      ),
    ).toBe(true);
  });

  it('does not expose rejected, expired, or unlinked rows as customer-selectable', () => {
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'REJECTED', providerProfileId: 'partner-marketplace' },
        'partner-first',
      ),
    ).toBe(false);
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'EXPIRED', providerProfileId: 'partner-marketplace' },
        'partner-first',
      ),
    ).toBe(false);
    expect(isCustomerSelectableBookingParticipant({ status: 'JOINED' }, 'partner-first')).toBe(false);
  });

  it('normalizes direct and nested partner ids', () => {
    expect(bookingParticipantPartnerId({ providerProfileId: 'direct-id' })).toBe('direct-id');
    expect(bookingParticipantPartnerId({ providerProfile: { id: 'nested-id' } })).toBe('nested-id');
    expect(bookingParticipantPartnerId({})).toBeNull();
  });
});
