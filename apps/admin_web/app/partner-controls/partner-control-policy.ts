export type PartnerControlBlockerKind =
  | 'ACCOUNT_BLOCK'
  | 'NEGATIVE_WALLET'
  | 'PAYOUT_HOLD'
  | 'URGENT_REPORT'
  | 'OVERDUE_REPORT'
  | 'OPEN_REPORT'
  | 'KYC_READINESS'
  | 'BANK_APPROVAL'
  | 'STALE_LOCATION'
  | 'OPTIONAL_TAX';

export type PartnerControlImpact = {
  readonly detail: string;
  readonly impacts: readonly string[];
  readonly nextAction: string;
  readonly reason: string;
  readonly tone: 'danger' | 'info' | 'warning';
};

const POLICY: Record<PartnerControlBlockerKind, PartnerControlImpact> = {
  ACCOUNT_BLOCK: {
    detail:
      'Marketplace visibility, invitation, final acceptance, service start, payout, and withdrawal are blocked.',
    impacts: ['Visibility', 'Invitation', 'Acceptance', 'Service start', 'Payout', 'Withdrawal'],
    nextAction: 'Review restriction evidence',
    reason: 'Account block',
    tone: 'danger',
  },
  NEGATIVE_WALLET: {
    detail:
      'Partner may remain visible. Final acceptance, service start, and payout release stay blocked until the debt is cleared.',
    impacts: ['Acceptance', 'Service start', 'Payout release'],
    nextAction: 'Review debt',
    reason: 'Negative wallet',
    tone: 'danger',
  },
  PAYOUT_HOLD: {
    detail:
      'Marketplace work remains available. Payout creation and release stay blocked until the restriction is lifted.',
    impacts: ['Payout creation', 'Payout release'],
    nextAction: 'Review payout hold',
    reason: 'Payout hold',
    tone: 'warning',
  },
  URGENT_REPORT: {
    detail:
      'The report requires priority evidence review. Operating impact changes only when an explicit restriction is applied.',
    impacts: ['Investigation'],
    nextAction: 'Review urgent report',
    reason: 'Urgent report',
    tone: 'danger',
  },
  OVERDUE_REPORT: {
    detail:
      'The report passed its severity-based review SLA. No operating gate is implied without an explicit restriction.',
    impacts: ['Investigation SLA'],
    nextAction: 'Review overdue report',
    reason: 'Overdue report',
    tone: 'warning',
  },
  OPEN_REPORT: {
    detail: 'The report needs review. No operating gate is implied without an explicit restriction.',
    impacts: ['Investigation'],
    nextAction: 'Review report',
    reason: 'Open report',
    tone: 'info',
  },
  KYC_READINESS: {
    detail: 'Identity readiness gates paid work approval and dispatch eligibility until KYC is approved.',
    impacts: ['Invitation', 'Acceptance', 'Service start'],
    nextAction: 'Review KYC',
    reason: 'KYC readiness',
    tone: 'warning',
  },
  BANK_APPROVAL: {
    detail: 'Work may continue under current policy, but payout release needs an approved bank account.',
    impacts: ['Payout release'],
    nextAction: 'Review bank account',
    reason: 'Bank approval',
    tone: 'warning',
  },
  STALE_LOCATION: {
    detail: 'Stale or missing location prevents reliable distance ordering and dispatch decisions.',
    impacts: ['Invitation', 'Dispatch'],
    nextAction: 'Refresh Partner location',
    reason: 'Stale location',
    tone: 'warning',
  },
  OPTIONAL_TAX: {
    detail:
      'Optional · no operating gate. This does not block Level 2 approval, matching, work, payout, or wallet withdrawal.',
    impacts: ['No operating gate'],
    nextAction: 'Record only when available',
    reason: 'Optional tax record',
    tone: 'info',
  },
};

export function partnerControlImpact(kind: PartnerControlBlockerKind) {
  return POLICY[kind];
}
