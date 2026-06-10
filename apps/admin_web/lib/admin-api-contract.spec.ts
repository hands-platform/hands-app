import type {
  AdminBooking,
  AdminBookingMatchSource,
  AdminBookingMatchingEvidence,
} from './admin-api';

describe('admin api contract types', () => {
  it('keeps persisted booking match source closed to the API enum values', () => {
    const firstPickSource: AdminBookingMatchSource = 'FIRST_PICK_ACCEPTED_FIRST';
    const customerSource: AdminBookingMatchSource = 'CUSTOMER_SELECTED_PARTNER';
    const booking = {
      id: 'booking-1',
      status: 'MATCHED',
      customerProfileId: 'customer-1',
      matchSource: firstPickSource,
    } satisfies AdminBooking;
    const matchingEvidence = {
      stage: 'MATCHED',
      finalSelection: 'FIRST_PICK_ACCEPTED',
      firstPickStatus: 'ACCEPTED',
      marketplaceParticipantCount: 1,
      selectableParticipantCount: 0,
      matchedAt: '2026-06-10T10:00:00.000Z',
      matchSource: customerSource,
      chatReady: true,
    } satisfies AdminBookingMatchingEvidence;

    expect(booking.matchSource).toBe('FIRST_PICK_ACCEPTED_FIRST');
    expect(matchingEvidence.matchSource).toBe('CUSTOMER_SELECTED_PARTNER');
  });
});
