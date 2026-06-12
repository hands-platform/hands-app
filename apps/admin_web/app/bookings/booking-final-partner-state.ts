import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';

export function bookingHasFinalPartner(booking: AdminBooking): boolean {
  if (booking.selectedProvider) {
    return true;
  }
  return (
    booking.matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED' ||
    booking.matchingEvidence?.finalSelection === 'CUSTOMER_SELECTED_PARTNER'
  );
}

export function bookingFinalPartnerLabel(booking: AdminBooking): string | null {
  if (booking.selectedProvider) {
    return partnerDisplayName(booking.selectedProvider, 'selected');
  }
  if (booking.matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED' && booking.preferredProvider) {
    return partnerDisplayName(booking.preferredProvider, 'selected');
  }
  return null;
}

function partnerDisplayName(provider?: { readonly displayName?: string | null } | null, fallback = 'Partner') {
  return marketplaceDisplayText(provider?.displayName ?? fallback);
}
