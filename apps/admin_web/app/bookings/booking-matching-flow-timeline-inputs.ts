import type { AdminBooking } from '../../lib/admin-api';
import type { BookingMatchingFlowTimelineInput } from '../../lib/booking-matching-flow-timeline';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingMatchingChatReady, isHandoffBookingStatus } from './booking-chat-handoff-state';
import { bookingLocationNeedsOpsInput } from './booking-location-ops-inputs';
import { bookingMatchingWindowExpired } from './booking-matching-window';

export type BookingMatchingFlowTimelineBookingFact = {
  readonly backupAlertNotifiedCount: number;
  readonly booking: AdminBooking;
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly hasChatRoom: boolean;
  readonly isLiveHandoff: boolean;
  readonly locationNeedsOps: boolean;
  readonly marketplaceParticipantCount: number;
  readonly responseWindowExpired: boolean;
  readonly status: string;
};

export type BookingMatchingFlowTimelineBookingFactInput = {
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly marketplaceParticipantCount: number;
};

export function bookingMatchingFlowTimelineBookingFact(
  booking: AdminBooking,
  nowMs: number,
  input: BookingMatchingFlowTimelineBookingFactInput,
): BookingMatchingFlowTimelineBookingFact {
  const status = booking.status;
  const open = status === 'OPEN_MATCHING';
  const matched = status === 'MATCHED';
  const liveHandoff = isHandoffBookingStatus(status);

  return {
    backupAlertNotifiedCount: open ? bookingBackupAlertTraceSummary(booking).totalNotified : 0,
    booking,
    customerSelectableCount: open ? input.customerSelectableCount : 0,
    firstPickPending: open ? input.firstPickPending : false,
    hasChatRoom: matched ? bookingMatchingChatReady(booking) : false,
    isLiveHandoff: liveHandoff,
    locationNeedsOps: liveHandoff
      ? bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs))
      : false,
    marketplaceParticipantCount: open ? input.marketplaceParticipantCount : 0,
    responseWindowExpired: open ? bookingMatchingWindowExpired(booking, nowMs) : false,
    status,
  };
}

export function bookingMatchingFlowTimelineInput(
  facts: readonly BookingMatchingFlowTimelineBookingFact[],
): BookingMatchingFlowTimelineInput<AdminBooking> {
  const open = facts.filter((fact) => fact.status === 'OPEN_MATCHING');
  const firstPickWaiting = open.filter((fact) => fact.firstPickPending);
  const liveHandoff = facts.filter((fact) => fact.isLiveHandoff);
  const matched = facts.filter((fact) => fact.status === 'MATCHED');

  return {
    backupAlerted: open
      .filter((fact) => fact.backupAlertNotifiedCount > 0)
      .map((fact) => fact.booking),
    customerChoice: open
      .filter((fact) => fact.customerSelectableCount > 0)
      .map((fact) => fact.booking),
    firstPickExpired: firstPickWaiting
      .filter((fact) => fact.responseWindowExpired)
      .map((fact) => fact.booking),
    firstPickWaiting: firstPickWaiting.map((fact) => fact.booking),
    liveHandoff: liveHandoff.map((fact) => fact.booking),
    locationChecks: liveHandoff.filter((fact) => fact.locationNeedsOps).map((fact) => fact.booking),
    marketplaceVisible: open
      .filter((fact) => fact.marketplaceParticipantCount > 0)
      .map((fact) => fact.booking),
    matched: matched.map((fact) => fact.booking),
    matchedWithoutChat: matched.filter((fact) => !fact.hasChatRoom).map((fact) => fact.booking),
    noSupply: open
      .filter((fact) => fact.marketplaceParticipantCount === 0)
      .map((fact) => fact.booking),
  };
}
