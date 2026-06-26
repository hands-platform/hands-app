import type { BookingMonitorViewMatchReaders } from './booking-monitor-view-match';
import { bookingMatchesMonitorView } from './booking-monitor-view-match';

type TrueReaderName = Exclude<keyof BookingMonitorViewMatchReaders, 'stageKey' | 'status'>;

function buildReaders(
  overrides: Partial<Record<TrueReaderName, boolean>> & {
    stageKey?: ReturnType<BookingMonitorViewMatchReaders['stageKey']>;
    status?: string;
  } = {},
): BookingMonitorViewMatchReaders {
  return {
    activeStatus: () => overrides.activeStatus ?? false,
    addressNeedsOps: () => overrides.addressNeedsOps ?? false,
    cashDebtNeedsOps: () => overrides.cashDebtNeedsOps ?? false,
    chatEvidenceNeedsOps: () => overrides.chatEvidenceNeedsOps ?? false,
    chatLive: () => overrides.chatLive ?? false,
    chatRepairNeedsOps: () => overrides.chatRepairNeedsOps ?? false,
    closeoutNeedsOps: () => overrides.closeoutNeedsOps ?? false,
    decisionEvidenceMissing: () => overrides.decisionEvidenceMissing ?? false,
    highPriorityCheck: () => overrides.highPriorityCheck ?? false,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    manualDecisionNeedsOps: () => overrides.manualDecisionNeedsOps ?? false,
    matchingEscalationNeedsOps: () => overrides.matchingEscalationNeedsOps ?? false,
    noSupply: () => overrides.noSupply ?? false,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    postMatchCancellation: () => overrides.postMatchCancellation ?? false,
    pricingPolicyNeedsOps: () => overrides.pricingPolicyNeedsOps ?? false,
    refundReviewNeedsOps: () => overrides.refundReviewNeedsOps ?? false,
    stageKey: () => overrides.stageKey ?? 'handoff',
    status: () => overrides.status ?? 'MATCHED',
  };
}

describe('bookingMatchesMonitorView', () => {
  it.each([
    ['attention', { highPriorityCheck: true }],
    ['matching', { matchingEscalationNeedsOps: true }],
    ['no-supply', { noSupply: true }],
    ['address', { addressNeedsOps: true }],
    ['manual-decision', { manualDecisionNeedsOps: true }],
    ['payment', { paymentNeedsOps: true }],
    ['cash-debt', { cashDebtNeedsOps: true }],
    ['closeout', { closeoutNeedsOps: true }],
    ['pricing', { pricingPolicyNeedsOps: true }],
    ['location', { locationNeedsOps: true }],
    ['chat', { chatLive: true }],
    ['chat-repair', { chatRepairNeedsOps: true }],
    ['chat-evidence', { chatEvidenceNeedsOps: true }],
    ['evidence-missing', { decisionEvidenceMissing: true }],
    ['refund-review', { refundReviewNeedsOps: true }],
    ['post-match-cancellations', { postMatchCancellation: true }],
  ] as const)('matches %s from its dedicated reader', (view, overrides) => {
    expect(bookingMatchesMonitorView(view, buildReaders(overrides))).toBe(true);
    expect(bookingMatchesMonitorView(view, buildReaders())).toBe(false);
  });

  it.each([
    ['first-pick', 'first-pick'],
    ['marketplace', 'marketplace'],
    ['customer-choice', 'customer-choice'],
    ['handoff-repair', 'handoff-repair'],
  ] as const)('matches %s from the booking stage key', (view, stageKey) => {
    expect(bookingMatchesMonitorView(view, buildReaders({ stageKey }))).toBe(true);
    expect(bookingMatchesMonitorView(view, buildReaders({ stageKey: 'handoff' }))).toBe(false);
  });

  it('matches terminal status and default active views', () => {
    expect(bookingMatchesMonitorView('expired', buildReaders({ status: 'EXPIRED' }))).toBe(true);
    expect(bookingMatchesMonitorView('no-show', buildReaders({ status: 'NO_SHOW' }))).toBe(true);
    expect(bookingMatchesMonitorView('all', buildReaders())).toBe(true);
    expect(bookingMatchesMonitorView('active', buildReaders({ activeStatus: true }))).toBe(true);
    expect(bookingMatchesMonitorView('blocked-create', buildReaders({ activeStatus: true }))).toBe(true);
  });
});
