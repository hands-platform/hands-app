import {
  toChecklistPillClass,
  type BookingChecklistClassName,
  type BookingChecklistPillClass,
} from './booking-closeout-checklist-rows';

export type BookingActionEvidenceGateInput = {
  bookingStatus: string;
  paymentExists: boolean;
  paymentStatus: string;
  paymentProviderRef?: string | null;
  paymentMethod?: string | null;
  paymentIsTerminal: boolean;
  hasChatArchive: boolean;
  hasDecisionEvidence: boolean;
  manualOutcomeEvidenceLabel: string;
  refundLedgerCount: number;
  cashDebt: boolean;
  closeoutAvailable: boolean;
  closeoutStatus: string;
  closeoutTone: string;
  closeoutOpenItemLabels: string[];
  closeoutHelper: string;
  completedCloseoutLabel: string;
  completedCloseoutTone: BookingChecklistPillClass;
  expireAvailable: boolean;
  hasAddressSnapshot: boolean;
  expiresAtLabel: string;
  expiresAtValue?: string | null;
  noShowAvailable: boolean;
};

export type BookingActionEvidenceGateRow = {
  action: string;
  status: string;
  evidence: string;
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
  operatorRule: string;
  href: string;
  className: BookingChecklistClassName;
  pillClass: BookingChecklistPillClass;
};

export type BookingActionEvidenceGate = {
  status: string;
  tone: BookingChecklistPillClass;
  rows: BookingActionEvidenceGateRow[];
};

export function bookingActionEvidenceGate(input: BookingActionEvidenceGateInput): BookingActionEvidenceGate {
  const paymentActionAvailable = input.paymentExists && !input.paymentIsTerminal;
  const paymentSyncAvailable = Boolean(input.paymentProviderRef) && !input.paymentIsTerminal;
  const completedWorkEvidenceReady =
    input.bookingStatus === 'COMPLETED' && input.hasChatArchive && input.paymentStatus === 'AUTHORIZED';
  const closeoutPillClass = toChecklistPillClass(input.closeoutTone);

  const rows: BookingActionEvidenceGateRow[] = [
    {
      action: 'Payment sync',
      status: paymentSyncAvailable ? 'Available' : 'Locked',
      evidence: input.paymentProviderRef
        ? `${input.paymentStatus} / gateway ref ${input.paymentProviderRef}`
        : `Payment status is ${input.paymentStatus}; no gateway reference is linked.`,
      operatorRule: 'Sync only when gateway reference exists and payment is still actionable.',
      href: '#booking-ops',
      className: paymentSyncAvailable ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: paymentSyncAvailable ? 'pill-success' : 'pill-neutral',
    },
    {
      action: 'Payment capture',
      status: completedWorkEvidenceReady
        ? 'Evidence ready'
        : input.paymentStatus === 'AUTHORIZED'
          ? 'Review first'
          : 'Locked',
      evidence:
        input.paymentStatus === 'AUTHORIZED'
          ? `${input.bookingStatus} / ${input.hasChatArchive ? 'chat archived' : 'chat missing'} / ${
              input.closeoutStatus
            }`
          : `Payment status is ${input.paymentStatus}. Capture is only relevant for active authorization.`,
      operatorRule:
        'Capture after completed service evidence is retained; do not capture from payment status alone.',
      href: '#booking-ops',
      className: completedWorkEvidenceReady
        ? 'ops-task-done'
        : input.paymentStatus === 'AUTHORIZED'
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: completedWorkEvidenceReady
        ? 'pill-success'
        : input.paymentStatus === 'AUTHORIZED'
          ? 'pill-warn'
          : 'pill-neutral',
    },
    {
      action: 'Release or refund',
      status: paymentActionAvailable
        ? input.hasDecisionEvidence
          ? 'Evidence ready'
          : 'Needs evidence'
        : 'Locked',
      evidence: paymentActionAvailable
        ? `${input.paymentStatus} / ${input.refundLedgerCount} refund row(s) / ${
            input.manualOutcomeEvidenceLabel || 'no retained decision evidence yet'
          }`
        : `${input.paymentStatus} payment cannot be released or refunded from this state.`,
      operatorRule: 'Require retained decision evidence before release/refund.',
      href: '#booking-ops',
      className: paymentActionAvailable
        ? input.hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: paymentActionAvailable
        ? input.hasDecisionEvidence
          ? 'pill-success'
          : 'pill-warn'
        : 'pill-neutral',
    },
    {
      action: 'Cash fee settlement',
      status: input.cashDebt ? 'Evidence required' : input.paymentMethod === 'CASH' ? 'Clear' : 'Not cash',
      evidence: input.cashDebt
        ? 'Partner cash fee debt is active. Operator needs deposit or admin offset evidence before clearing.'
        : input.paymentMethod === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${input.paymentMethod ?? 'NONE'} booking path.`,
      operatorRule:
        'Negative wallet Partners can view marketplace requests, but final acceptance, service start, and payout actions wait for settlement evidence.',
      href: input.cashDebt ? '/cash-settlements' : '#finance',
      className: input.cashDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: input.cashDebt ? 'pill-danger' : input.paymentMethod === 'CASH' ? 'pill-success' : 'pill-neutral',
    },
    {
      action: 'Completed closeout',
      status: input.closeoutAvailable ? input.closeoutStatus : input.completedCloseoutLabel,
      evidence: input.closeoutOpenItemLabels.length
        ? input.closeoutOpenItemLabels.join(', ')
        : input.closeoutHelper,
      operatorRule:
        'Run completed closeout only after payment, earning, tax, platform fee, wallet, and chat records align.',
      href: '#completed-closeout',
      className: input.closeoutAvailable
        ? closeoutPillClass === 'pill-danger'
          ? 'ops-task-blocked'
          : 'ops-task-warning'
        : 'ops-task-done',
      pillClass: input.closeoutAvailable ? closeoutPillClass : input.completedCloseoutTone,
    },
    {
      action: 'Expire matching',
      status: input.expireAvailable ? (input.hasAddressSnapshot ? 'Ready' : 'Needs address') : 'Locked',
      evidence: input.expireAvailable
        ? input.expiresAtLabel
        : `Expire unavailable for ${input.bookingStatus}.`,
      evidenceDateTimePrefix: input.expireAvailable
        ? `${input.hasAddressSnapshot ? 'Address snapshot ready' : 'Address snapshot missing'} / expires `
        : undefined,
      evidenceDateTimeValue: input.expireAvailable ? input.expiresAtValue : null,
      operatorRule:
        'Expire only when the customer should stop waiting and payment release/review path is understood.',
      href: '#matching-expiry',
      className: input.expireAvailable
        ? input.hasAddressSnapshot
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: input.expireAvailable ? (input.hasAddressSnapshot ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
    {
      action: 'No-show handling',
      status: input.noShowAvailable
        ? input.hasDecisionEvidence
          ? 'Evidence ready'
          : 'Needs evidence'
        : 'Locked',
      evidence: input.noShowAvailable
        ? input.manualOutcomeEvidenceLabel || 'No chat, alert, location, note, or audit evidence is loaded yet.'
        : `No-show unavailable for ${input.bookingStatus}.`,
      operatorRule:
        'No-show is an admin evidence decision. Record what happened with factual service context only.',
      href: '#no-show-handling',
      className: input.noShowAvailable
        ? input.hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: input.noShowAvailable ? (input.hasDecisionEvidence ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
  ];

  const needsEvidence = rows.filter((row) => row.className === 'ops-task-warning').length;
  const blocked = rows.filter((row) => row.className === 'ops-task-blocked').length;

  return {
    status: needsEvidence
      ? `${needsEvidence} need evidence`
      : blocked
        ? `${blocked} locked`
        : 'Evidence ready',
    tone: needsEvidence ? 'pill-warn' : blocked ? 'pill-neutral' : 'pill-success',
    rows,
  };
}
