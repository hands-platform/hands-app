import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMatchingRuleSnapshot,
  type BookingMatchingRuleSnapshot,
} from '../../lib/booking-matching-rule-snapshot';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { terminalBookingStatuses } from './booking-closure-list-signal';
import { bookingMarketplaceParticipantCount, bookingCustomerSelectableCount } from './booking-marketplace-count-facts';
import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';
import { bookingMatchingWindowLabel } from './booking-matching-window';
import { partnerDisplayName } from './booking-monitor-labels';

export function buildBookingMonitorMatchingRuleSnapshot(
  booking: AdminBooking,
  nowMs: number,
): BookingMatchingRuleSnapshot {
  const policy = bookingMatchingPolicySnapshot(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);
  const selectableCount = bookingCustomerSelectableCount(booking);
  const alertSummary = bookingBackupAlertTraceSummary(booking, nowMs);

  return buildBookingMatchingRuleSnapshot({
    hasChatRoom: bookingMatchingChatReady(booking),
    isTerminalStatus: terminalBookingStatuses.has(booking.status),
    marketplaceCount,
    openMatchingWindowLabel: bookingMatchingWindowLabel(booking, nowMs),
    policy,
    selectableCount,
    selectedPartnerLabel: booking.selectedProvider ? partnerDisplayName(booking.selectedProvider) : null,
    status: booking.status,
    totalNotified: alertSummary.totalNotified,
  });
}
