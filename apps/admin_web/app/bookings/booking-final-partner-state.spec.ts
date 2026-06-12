import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingFinalPartnerLabel,
  bookingHasFinalPartner,
} from './booking-final-partner-state';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking final partner state', () => {
  it('uses the selected provider relation as the final partner label', () => {
    const item = booking({
      selectedProvider: { id: 'selected', displayName: 'Selected Partner' } as AdminBooking['selectedProvider'],
      status: 'MATCHED',
    });

    expect(bookingHasFinalPartner(item)).toBe(true);
    expect(bookingFinalPartnerLabel(item)).toBe('Selected Partner');
  });

  it('uses first-pick accepted evidence when the selected provider relation is absent', () => {
    const item = booking({
      matchingEvidence: { finalSelection: 'FIRST_PICK_ACCEPTED' } as AdminBooking['matchingEvidence'],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'MATCHED',
    });

    expect(bookingHasFinalPartner(item)).toBe(true);
    expect(bookingFinalPartnerLabel(item)).toBe('First Pick');
  });

  it('keeps customer-selected evidence present even when the display relation is missing', () => {
    const item = booking({
      matchingEvidence: {
        finalSelection: 'CUSTOMER_SELECTED_PARTNER',
      } as AdminBooking['matchingEvidence'],
      status: 'MATCHED',
    });

    expect(bookingHasFinalPartner(item)).toBe(true);
    expect(bookingFinalPartnerLabel(item)).toBeNull();
  });

  it('does not treat preferred provider alone as a final partner', () => {
    const item = booking({
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(bookingHasFinalPartner(item)).toBe(false);
    expect(bookingFinalPartnerLabel(item)).toBeNull();
  });
});
