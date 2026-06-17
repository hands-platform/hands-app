import type { AdminBookingMatchingEvidence } from './admin-api';
import { customerSelectedFinalPartnerPathCopy } from './booking-selection-copy';

type AdminBookingFinalSelection = AdminBookingMatchingEvidence['finalSelection'];

export type BookingFinalSelectionCopy = {
  readonly label: string;
  readonly pathLabel?: string;
  readonly toneClass: 'pill-success' | 'pill-warn';
};

export function bookingFinalSelectionCopy(
  finalSelection?: AdminBookingFinalSelection | null,
): BookingFinalSelectionCopy | null {
  if (!finalSelection) {
    return null;
  }

  switch (finalSelection) {
    case 'FIRST_PICK_ACCEPTED':
      return {
        label: 'First-pick Partner accepted first',
        pathLabel: 'First-pick Partner validly accepted first through the API',
        toneClass: 'pill-success',
      };
    case 'CUSTOMER_SELECTED_PARTNER':
      return {
        label: 'Customer selected final Partner',
        pathLabel: customerSelectedFinalPartnerPathCopy,
        toneClass: 'pill-success',
      };
    case 'CUSTOMER_SELECTION_AVAILABLE':
      return {
        label: 'Customer final choice pending',
        toneClass: 'pill-warn',
      };
    case 'FIRST_PICK_PENDING':
    case 'WAITING_FOR_PARTNERS':
    case 'NOT_READY':
      return null;
    default:
      return assertNever(finalSelection);
  }
}

function assertNever(value: never): null {
  return value;
}
