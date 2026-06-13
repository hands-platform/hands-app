import type { AdminBooking } from '../../lib/admin-api';
import { bookingCustomerVisibleStateLabel } from './booking-customer-visible-state';
import { bookingFinalPartnerLabel } from './booking-final-partner-state';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceParticipantCount,
} from './booking-marketplace-count-facts';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export function buildBookingMonitorCustomerVisibleStateLabel(booking: AdminBooking) {
  return bookingCustomerVisibleStateLabel(booking, {
    selectedPartnerLabel: bookingFinalPartnerLabel(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
    customerSelectablePartnerCount: bookingCustomerSelectableCount(booking),
    preferredAwaitingDecision: bookingFirstPickPending(booking),
    marketplacePartnerCount: bookingMarketplaceParticipantCount(booking),
  });
}
