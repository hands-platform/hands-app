import { bookingFinalSelectionCopy } from './booking-final-selection-copy';

describe('bookingFinalSelectionCopy', () => {
  it('returns first-pick accepted copy from API final selection evidence', () => {
    expect(bookingFinalSelectionCopy('FIRST_PICK_ACCEPTED')).toEqual({
      label: 'First-pick Partner accepted first',
      pathLabel: 'First-pick Partner validly accepted first through the API',
      toneClass: 'pill-success',
    });
  });

  it('returns customer-selected copy from API final selection evidence', () => {
    expect(bookingFinalSelectionCopy('CUSTOMER_SELECTED_PARTNER')).toEqual({
      label: 'Customer selected final Partner',
      pathLabel: 'Customer reviewed participants and selected the final Partner',
      toneClass: 'pill-success',
    });
  });

  it('returns customer-choice pending label and warning tone without overriding path fallback', () => {
    expect(bookingFinalSelectionCopy('CUSTOMER_SELECTION_AVAILABLE')).toEqual({
      label: 'Customer final choice pending',
      toneClass: 'pill-warn',
    });
  });

  it('lets local fallback copy handle non-final API states', () => {
    expect(bookingFinalSelectionCopy('FIRST_PICK_PENDING')).toBeNull();
    expect(bookingFinalSelectionCopy('WAITING_FOR_PARTNERS')).toBeNull();
    expect(bookingFinalSelectionCopy('NOT_READY')).toBeNull();
    expect(bookingFinalSelectionCopy(null)).toBeNull();
    expect(bookingFinalSelectionCopy(undefined)).toBeNull();
  });
});
