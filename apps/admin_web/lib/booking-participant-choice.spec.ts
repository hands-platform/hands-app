import {
  bookingCustomerSelectableParticipants,
  bookingHasCustomerSelectablePartner,
  bookingMarketplaceParticipants,
  isCustomerSelectableBookingParticipant,
} from './booking-participant-choice';

const preferred = { id: 'partner_preferred' };
const marketplace = { id: 'partner_marketplace' };

describe('booking participant choice rules', () => {
  it('makes accepted and selected participants customer-selectable', () => {
    expect(isCustomerSelectableBookingParticipant({ status: 'ACCEPTED', providerProfile: marketplace })).toBe(
      true,
    );
    expect(isCustomerSelectableBookingParticipant({ status: 'SELECTED', providerProfile: marketplace })).toBe(
      true,
    );
  });

  it('keeps joined first-pick partner out of customer-selectable marketplace options', () => {
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'JOINED', providerProfile: preferred },
        'partner_preferred',
      ),
    ).toBe(false);
    expect(
      isCustomerSelectableBookingParticipant(
        { status: 'JOINED', providerProfile: marketplace },
        'partner_preferred',
      ),
    ).toBe(true);
  });

  it('filters marketplace participants without rejected rows or the preferred partner', () => {
    const participants = [
      { status: 'JOINED', providerProfile: preferred },
      { status: 'JOINED', providerProfile: marketplace },
      { status: 'REJECTED', providerProfile: { id: 'partner_rejected' } },
      { status: 'ACCEPTED', providerProfile: { id: 'partner_accepted' } },
      { status: 'JOINED', providerProfile: null },
    ];

    expect(bookingMarketplaceParticipants(participants, 'partner_preferred').map((row) => row.providerProfile?.id)).toEqual([
      'partner_marketplace',
      'partner_accepted',
    ]);
  });

  it('keeps selected rows in customer-selectable history while the booking is still unmatched', () => {
    const participants = [
      { status: 'JOINED', providerProfile: preferred },
      { status: 'JOINED', providerProfile: marketplace },
      { status: 'SELECTED', providerProfile: { id: 'partner_selected' } },
    ];

    expect(
      bookingCustomerSelectableParticipants(participants, 'partner_preferred').map((row) => row.providerProfile?.id),
    ).toEqual(['partner_marketplace', 'partner_selected']);
  });

  it('deduplicates customer-selectable partners and keeps the strongest state', () => {
    const participants = [
      { status: 'JOINED', providerProfile: marketplace },
      { status: 'ACCEPTED', providerProfile: marketplace },
      { status: 'JOINED', providerProfile: { id: 'partner_second' } },
    ];

    expect(bookingCustomerSelectableParticipants(participants, 'partner_preferred')).toEqual([
      { status: 'ACCEPTED', providerProfile: marketplace },
      { status: 'JOINED', providerProfile: { id: 'partner_second' } },
    ]);
  });

  it('requires a selectable participant and no selected final partner for customer choice pending', () => {
    const participants = [{ status: 'JOINED', providerProfile: marketplace }];

    expect(bookingHasCustomerSelectablePartner(participants, 'partner_preferred', null)).toBe(true);
    expect(bookingHasCustomerSelectablePartner(participants, 'partner_preferred', 'partner_marketplace')).toBe(false);
  });
});
