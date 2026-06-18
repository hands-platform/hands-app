import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorViewMatchReadersFromBooking,
  type BookingMonitorViewOpsReaders,
} from './booking-monitor-view-match-readers';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    ...overrides,
  } as AdminBooking;
}

function opsReaders(
  overrides: Partial<Record<keyof BookingMonitorViewOpsReaders, boolean>> = {},
): BookingMonitorViewOpsReaders {
  return {
    addressNeedsOps: () => overrides.addressNeedsOps ?? false,
    cashDebtNeedsOps: () => overrides.cashDebtNeedsOps ?? false,
    chatEvidenceNeedsOps: () => overrides.chatEvidenceNeedsOps ?? false,
    closeoutNeedsOps: () => overrides.closeoutNeedsOps ?? false,
    decisionEvidenceMissing: () => overrides.decisionEvidenceMissing ?? false,
    highPriorityCheck: () => overrides.highPriorityCheck ?? false,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    manualDecisionNeedsOps: () => overrides.manualDecisionNeedsOps ?? false,
    matchingEscalationNeedsOps: () => overrides.matchingEscalationNeedsOps ?? false,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    pricingPolicyNeedsOps: () => overrides.pricingPolicyNeedsOps ?? false,
    refundReviewNeedsOps: () => overrides.refundReviewNeedsOps ?? false,
    stageKey: () => 'handoff',
  };
}

describe('bookingMonitorViewMatchReadersFromBooking', () => {
  it('maps booking state into shared view readers', () => {
    const readers = bookingMonitorViewMatchReadersFromBooking(
      booking({
        status: 'PROVIDER_ON_THE_WAY',
        chatRoom: { id: 'chat-1', messages: [] } as AdminBooking['chatRoom'],
      }),
      opsReaders({ paymentNeedsOps: true }),
    );

    expect(readers.activeStatus()).toBe(true);
    expect(readers.chatLive()).toBe(true);
    expect(readers.chatRepairNeedsOps()).toBe(false);
    expect(readers.noSupply()).toBe(false);
    expect(readers.paymentNeedsOps()).toBe(true);
    expect(readers.status()).toBe('PROVIDER_ON_THE_WAY');
  });

  it('detects open matching bookings without supply', () => {
    const readers = bookingMonitorViewMatchReadersFromBooking(
      booking({
        status: 'OPEN_MATCHING',
        participants: [],
      }),
      opsReaders(),
    );

    expect(readers.activeStatus()).toBe(true);
    expect(readers.noSupply()).toBe(true);
  });

  it('keeps non-active terminal bookings out of the active reader', () => {
    const readers = bookingMonitorViewMatchReadersFromBooking(
      booking({ status: 'EXPIRED' }),
      opsReaders({ closeoutNeedsOps: true }),
    );

    expect(readers.activeStatus()).toBe(false);
    expect(readers.closeoutNeedsOps()).toBe(true);
    expect(readers.status()).toBe('EXPIRED');
  });

  it('includes no-show bookings with match evidence in the post-match cancellation review reader', () => {
    const readers = bookingMonitorViewMatchReadersFromBooking(
      booking({
        matchedAt: '2026-06-19T09:00:00.000Z',
        selectedProviderId: 'partner-1',
        status: 'NO_SHOW',
      }),
      opsReaders(),
    );
    const preMatchNoShowReaders = bookingMonitorViewMatchReadersFromBooking(
      booking({
        matchedAt: null,
        selectedProviderId: null,
        status: 'NO_SHOW',
      }),
      opsReaders(),
    );

    expect(readers.postMatchCancellation()).toBe(true);
    expect(preMatchNoShowReaders.postMatchCancellation()).toBe(false);
  });
});
