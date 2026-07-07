type GuardrailTone = 'pill-success' | 'pill-danger' | 'pill-info' | 'pill-warn' | 'pill-neutral';

export type BookingDecisionEvidenceGuardrailRow = {
  id: string;
  title: string;
  scope: string;
  status: string;
  tone: GuardrailTone;
  evidence: string;
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
  nextStep: string;
  href: string;
};

export type BookingDecisionEvidenceGuardrailsInput = {
  bookingStatus: string;
  hasAddressSnapshot: boolean;
  addressSnapshotLabel: string;
  addressPinLabel: string;
  hasSelectedPartner: boolean;
  selectedPartnerLabel: string;
  participantCount: number;
  preferredPartnerLabel: string;
  hasChatRoom: boolean;
  chatRoomShortId?: string | null;
  messageCount: number;
  hasLatestLocation: boolean;
  latestLocationAtLabel?: string | null;
  latestLocationAtValue?: string | null;
  notificationCount: number;
  operatorNoteCount: number;
  hasOpsTrail: boolean;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentAmountLabel: string;
  refundRowCount: number;
  cashFeeDebtNeedsSettlement: boolean;
  platformFeeLabel: string;
  withholdingLabel: string;
  walletLedgerLabel: string;
  closeoutOpenItemLabels: string[];
  financeLedgerRowCount: number;
  partnerPayoutLabel: string;
};

const CHAT_REQUIRED_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
]);

const COORDINATE_PAIR_TEXT_RE = /\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b/;

function safeAddressPinEvidence(label: string) {
  return COORDINATE_PAIR_TEXT_RE.test(label) ? 'Confirmed service address saved' : label;
}

export function bookingDecisionEvidenceGuardrails(
  input: BookingDecisionEvidenceGuardrailsInput,
): BookingDecisionEvidenceGuardrailRow[] {
  const chatRequired = CHAT_REQUIRED_STATUSES.has(input.bookingStatus);
  const hasSupportingContext =
    input.messageCount > 0 ||
    input.hasLatestLocation ||
    input.notificationCount > 0 ||
    input.operatorNoteCount > 0;
  const hasPayment = Boolean(input.paymentStatus || input.paymentMethod);
  const hasCloseoutBlockers = input.closeoutOpenItemLabels.length > 0;

  return [
    {
      id: 'required-address',
      title: 'Required: confirmed service address',
      scope: 'Use the confirmed booking address for marketplace distance and support review.',
      status: input.hasAddressSnapshot ? 'Ready' : 'Needs repair',
      tone: input.hasAddressSnapshot ? 'pill-success' : 'pill-danger',
      evidence: input.hasAddressSnapshot
        ? `${input.addressSnapshotLabel} / ${safeAddressPinEvidence(input.addressPinLabel)}`
        : 'No confirmed service address is attached.',
      nextStep: input.hasAddressSnapshot
        ? 'Use this address for Partner radius, support, and settlement review.'
        : 'Repair or attach address evidence before relying on distance or closeout decisions.',
      href: '#address-radius-contract',
    },
    {
      id: 'required-final-partner',
      title: 'Required: customer final Partner choice',
      scope: 'HANDS does not auto-assign; customer choice creates the final handoff.',
      status: input.hasSelectedPartner ? 'Final Partner saved' : 'Customer choice pending',
      tone: input.hasSelectedPartner
        ? 'pill-success'
        : input.bookingStatus === 'OPEN_MATCHING'
          ? 'pill-info'
          : 'pill-warn',
      evidence: input.hasSelectedPartner
        ? input.selectedPartnerLabel
        : `${input.participantCount} marketplace participant(s) / preferred ${input.preferredPartnerLabel}`,
      nextStep: input.hasSelectedPartner
        ? 'Confirm chat, location, and payment handoff.'
        : 'Keep the customer selection state visible; do not auto-select a Partner.',
      href: '#participants',
    },
    {
      id: 'required-chat',
      title: 'Required after match: retained chat',
      scope: 'Matched bookings need customer-Partner chat; admin keeps the record after mobile closeout.',
      status: input.hasChatRoom ? 'Chat record ready' : chatRequired ? 'Repair needed' : 'Locked until match',
      tone: input.hasChatRoom ? 'pill-success' : chatRequired ? 'pill-danger' : 'pill-info',
      evidence: input.hasChatRoom
        ? `Room ${input.chatRoomShortId ?? 'missing'} / ${input.messageCount} message(s)`
        : chatRequired
          ? 'Matched or service-stage booking has no retained room.'
          : 'Chat opens only after final Partner selection.',
      nextStep: input.hasChatRoom
        ? 'Use the retained transcript for support and outcome review.'
        : chatRequired
          ? 'Repair the chat handoff before service coordination or money actions.'
          : 'Wait for customer final Partner selection.',
      href: '#chat',
    },
    {
      id: 'supporting-context',
      title: 'Supporting: communication and movement context',
      scope:
        'Chat messages, Partner pin, alerts, and notes explain what happened without judging either side.',
      status: hasSupportingContext ? 'Context loaded' : 'Needs factual note',
      tone: hasSupportingContext ? 'pill-success' : 'pill-warn',
      evidence: input.hasLatestLocation && input.latestLocationAtLabel && input.latestLocationAtValue
        ? input.latestLocationAtLabel
        : [
            `${input.messageCount} message(s)`,
            input.hasLatestLocation && input.latestLocationAtLabel
              ? `location ${input.latestLocationAtLabel}`
              : 'no Partner pin',
            `${input.notificationCount} alert row(s)`,
            `${input.operatorNoteCount} note(s)`,
          ].join(' / '),
      evidenceDateTimePrefix:
        input.hasLatestLocation && input.latestLocationAtLabel && input.latestLocationAtValue
          ? `${input.messageCount} message(s) / location `
          : undefined,
      evidenceDateTimeSuffix:
        input.hasLatestLocation && input.latestLocationAtLabel && input.latestLocationAtValue
          ? ` / ${input.notificationCount} alert row(s) / ${input.operatorNoteCount} note(s)`
          : undefined,
      evidenceDateTimeValue:
        input.hasLatestLocation && input.latestLocationAtLabel ? input.latestLocationAtValue : null,
      nextStep: hasSupportingContext
        ? 'Review the factual context before outcome changes.'
        : 'Add a factual operator note before no-show, refund, or closure handling.',
      href: '#booking-chat-evidence-decision-board',
    },
    {
      id: 'finance-payment',
      title: 'Finance: payment and refund path',
      scope: 'Payment, refund, release, and capture actions must match the booking outcome state.',
      status: hasPayment ? input.paymentStatus ?? 'Payment row' : 'No payment row',
      tone: hasPayment ? 'pill-info' : 'pill-warn',
      evidence: hasPayment
        ? `${input.paymentMethod ?? 'UNKNOWN'} / ${input.paymentAmountLabel} / ${input.refundRowCount} refund row(s)`
        : 'No payment record is attached.',
      nextStep: hasPayment
        ? 'Use payment status with chat, notes, and closeout state before money actions.'
        : 'Create or inspect payment state before finance closeout.',
      href: '#payment',
    },
    {
      id: 'finance-cash-debt',
      title: 'Finance: cash fee debt gate',
      scope:
        'Cash bookings can create Partner fee debt; negative wallet gates final acceptance, service start, and payout release.',
      status: input.cashFeeDebtNeedsSettlement
        ? 'Settlement required'
        : input.paymentMethod === 'CASH'
          ? 'Cash clear'
          : 'Not cash',
      tone: input.cashFeeDebtNeedsSettlement
        ? 'pill-danger'
        : input.paymentMethod === 'CASH'
          ? 'pill-success'
          : 'pill-neutral',
      evidence:
        input.paymentMethod === 'CASH'
          ? `${input.platformFeeLabel} HANDS fee / ${input.withholdingLabel} withholding / ${input.walletLedgerLabel}`
          : `${input.paymentMethod ?? 'No method'} payment path`,
      nextStep: input.cashFeeDebtNeedsSettlement
        ? 'Record verified company deposit or approved admin offset before clearing the block.'
        : 'No cash-fee settlement action is needed from this booking state.',
      href: input.cashFeeDebtNeedsSettlement ? '/cash-settlements' : '#finance',
    },
    {
      id: 'finance-closeout',
      title: 'Finance: completion closeout ledger',
      scope: 'Completed service closeout should align earning, fee, tax, wallet, and payment rows.',
      status: hasCloseoutBlockers ? `${input.closeoutOpenItemLabels.length} item(s) open` : 'Aligned',
      tone: hasCloseoutBlockers ? 'pill-warn' : 'pill-success',
      evidence: hasCloseoutBlockers
        ? input.closeoutOpenItemLabels.join(', ')
        : `${input.financeLedgerRowCount} finance ledger row(s) / ${input.partnerPayoutLabel} Partner payout`,
      nextStep: hasCloseoutBlockers
        ? 'Clear the listed records before completed-service closeout.'
        : 'Finance records are aligned for this booking stage.',
      href: '#completed-closeout',
    },
    {
      id: 'ops-trail',
      title: 'Operations: task and audit trail',
      scope: 'Structured tasks and audit rows preserve who changed what and why.',
      status: input.hasOpsTrail ? 'Trail retained' : 'No ops trail',
      tone: input.hasOpsTrail ? 'pill-success' : 'pill-warn',
      evidence: input.hasOpsTrail ? 'Task or audit trail retained' : 'No task or audit trail retained',
      nextStep: input.hasOpsTrail
        ? 'Use the trail to explain the current booking state.'
        : 'Add a task or note before manual outcome handling.',
      href: '#booking-activity',
    },
  ];
}
