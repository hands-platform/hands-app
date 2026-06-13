import type { AdminBooking } from '../../lib/admin-api';
import { bookingMarketplaceParticipantCount } from './booking-marketplace-count-facts';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingOpsSignalState, type BookingOpsSignalTone } from './booking-ops-signal-state';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision as bookingFirstPickPending,
} from './booking-preferred-provider-state';

export function bookingMonitorOpsSignal(booking: AdminBooking) {
  const state = bookingMonitorOpsSignalStateForBooking(booking);
  return bookingOpsSignal(state.tone, state.label);
}

export function bookingMonitorOpsSignalStateForBooking(booking: AdminBooking) {
  return bookingOpsSignalState({
    backupSelected: () => bookingIsBackupSelected(booking),
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    firstPickPending: () => bookingFirstPickPending(booking),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: () => bookingMatchingChatReady(booking),
    payment: booking.payment,
    status: booking.status,
  });
}

function bookingOpsSignal(tone: BookingOpsSignalTone, label: string) {
  return <span className={`signal signal-${tone}`}>{label}</span>;
}
