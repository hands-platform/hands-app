import type { AdminBooking } from '../../lib/admin-api';
import { customerVisibleStateLabelFromFacts } from '../../lib/customer-visible-state-label';

export type BookingCustomerVisibleStateFacts = {
  readonly customerSelectablePartnerCount: number;
  readonly hasChatRoom: boolean;
  readonly marketplacePartnerCount: number;
  readonly preferredAwaitingDecision: boolean;
  readonly selectedPartnerLabel: string | null;
};

export function bookingCustomerVisibleStateLabel(
  booking: AdminBooking,
  facts: BookingCustomerVisibleStateFacts,
): string {
  return customerVisibleStateLabelFromFacts({
    customerSelectablePartnerCount: facts.customerSelectablePartnerCount,
    hasChatRoom: facts.hasChatRoom,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    marketplacePartnerCount: facts.marketplacePartnerCount,
    preferredAwaitingDecision: facts.preferredAwaitingDecision,
    selectedPartnerLabel: facts.selectedPartnerLabel,
    status: booking.status,
  });
}
