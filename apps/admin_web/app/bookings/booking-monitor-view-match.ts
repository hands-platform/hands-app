import type { BookingListStageKey } from '../../lib/booking-list-stage';
import type { BookingPageView } from './booking-page-params';

export type BookingMonitorViewMatchReaders = {
  readonly activeStatus: () => boolean;
  readonly addressNeedsOps: () => boolean;
  readonly cashDebtNeedsOps: () => boolean;
  readonly chatEvidenceNeedsOps: () => boolean;
  readonly chatLive: () => boolean;
  readonly chatRepairNeedsOps: () => boolean;
  readonly closeoutNeedsOps: () => boolean;
  readonly decisionEvidenceMissing: () => boolean;
  readonly highPriorityCheck: () => boolean;
  readonly locationNeedsOps: () => boolean;
  readonly manualDecisionNeedsOps: () => boolean;
  readonly matchingEscalationNeedsOps: () => boolean;
  readonly noSupply: () => boolean;
  readonly paymentNeedsOps: () => boolean;
  readonly postMatchCancellation: () => boolean;
  readonly pricingPolicyNeedsOps: () => boolean;
  readonly refundReviewNeedsOps: () => boolean;
  readonly stageKey: () => BookingListStageKey;
  readonly status: () => string;
};

export function bookingMatchesMonitorView(view: BookingPageView, readers: BookingMonitorViewMatchReaders) {
  switch (view) {
    case 'attention':
      return readers.highPriorityCheck();
    case 'matching':
      return readers.matchingEscalationNeedsOps();
    case 'in-service':
      return readers.status() === 'IN_SERVICE';
    case 'first-pick':
      return readers.stageKey() === 'first-pick';
    case 'marketplace':
      return readers.stageKey() === 'marketplace';
    case 'customer-choice':
      return readers.stageKey() === 'customer-choice';
    case 'handoff-repair':
      return readers.stageKey() === 'handoff-repair';
    case 'no-supply':
      return readers.noSupply();
    case 'address':
      return readers.addressNeedsOps();
    case 'manual-decision':
      return readers.manualDecisionNeedsOps();
    case 'payment':
      return readers.paymentNeedsOps();
    case 'cash-debt':
      return readers.cashDebtNeedsOps();
    case 'closeout':
      return readers.closeoutNeedsOps();
    case 'pricing':
      return readers.pricingPolicyNeedsOps();
    case 'location':
      return readers.locationNeedsOps();
    case 'chat':
      return readers.chatLive();
    case 'chat-repair':
      return readers.chatRepairNeedsOps();
    case 'chat-evidence':
      return readers.chatEvidenceNeedsOps();
    case 'evidence-missing':
      return readers.decisionEvidenceMissing();
    case 'refund-review':
      return readers.refundReviewNeedsOps();
    case 'post-match-cancellations':
      return readers.postMatchCancellation();
    case 'expired':
      return readers.status() === 'EXPIRED';
    case 'no-show':
      return readers.status() === 'NO_SHOW';
    case 'all':
      return true;
    case 'active':
    case 'blocked-create':
    default:
      return readers.activeStatus();
  }
}
