import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { bookingMarketplaceParticipants } from './booking-marketplace-count-facts';

export function bookingCustomerLabel(booking: AdminBooking) {
  return booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
}

export function bookingProviderLabel(booking: AdminBooking) {
  const provider =
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    bookingMarketplaceParticipants(booking)[0]?.providerProfile?.displayName;
  return provider ? `Partner ${partnerDisplayName({ displayName: provider })}` : 'Partner pending';
}

export function partnerDisplayName(
  provider?: { readonly displayName?: string | null } | null,
  fallback = 'Partner',
) {
  return marketplaceDisplayText(provider?.displayName ?? fallback);
}
