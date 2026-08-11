export type BookingEvidenceRefundRow = {
  status: string;
  amountLabel: string;
};

export type BookingEvidencePacketInput = {
  chatReady: boolean;
  messageCount: number;
  latestMessageAtLabel?: string | null;
  latestMessageAtValue?: string | null;
  locationTrailCount: number;
  latestLocationAtLabel?: string | null;
  latestLocationAtValue?: string | null;
  latestLocationCoordinateLabel?: string | null;
  paymentStatus: string;
  paymentMethod: string;
  paymentAmountLabel: string;
  refundRows: BookingEvidenceRefundRow[];
  alertCount: number;
  failedAlertCount: number;
  marketplaceBatchCount: number;
  operatorNoteLines: string[];
  auditLogCount: number;
  opsTaskCount: number;
  hasAddressSnapshot: boolean;
  addressSnapshotLabel: string;
  addressPinLabel?: string | null;
  chatRoomShortId?: string | null;
  customerPriceLabel: string;
  walletLedgerLabel: string;
  refundEvidence: string;
  activityRecordCount: number;
  latestActivityTitle?: string | null;
  latestActivityAtLabel?: string | null;
  latestActivityAtValue?: string | null;
};

type EvidenceTone = 'pill-success' | 'pill-warn';

const COORDINATE_PAIR_TEXT_RE = /\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b/;

function safeAddressSnapshotLabel(label: string) {
  return COORDINATE_PAIR_TEXT_RE.test(label) ? 'Confirmed service address saved' : label;
}

function safePartnerLocationEvidenceLabel(label: string) {
  return COORDINATE_PAIR_TEXT_RE.test(label) ? 'saved for dispatch checks' : label;
}

function partnerLocationMetricHelper(label?: string | null) {
  if (!label) {
    return 'No Partner location is saved for this booking yet.';
  }

  if (COORDINATE_PAIR_TEXT_RE.test(label)) {
    return 'Latest Partner location is saved for dispatch checks.';
  }

  return `${label} latest Partner location.`;
}

export type BookingEvidencePacket = {
  status: string;
  tone: EvidenceTone;
  summary: string;
  metrics: Array<{ label: string; value: string; helper: string; dateTimeValue?: string | null }>;
  records: Array<{
    id: string;
    label: string;
    title: string;
    detail: string;
    evidence: string;
    evidenceDateTimePrefix?: string;
    evidenceDateTimeSuffix?: string;
    evidenceDateTimeValue?: string | null;
    href: string;
  }>;
};

export function bookingEvidencePacket(input: BookingEvidencePacketInput): BookingEvidencePacket {
  const evidenceCount =
    input.messageCount +
    input.locationTrailCount +
    input.alertCount +
    input.refundRows.length +
    input.operatorNoteLines.length +
    input.auditLogCount;
  const hasDecisionEvidence = input.messageCount > 0 && input.operatorNoteLines.length > 0;
  const hasPartialEvidence =
    input.messageCount > 0 ||
    input.locationTrailCount > 0 ||
    input.alertCount > 0 ||
    input.operatorNoteLines.length > 0;
  const status = hasDecisionEvidence ? 'Evidence ready' : hasPartialEvidence ? 'Evidence partial' : 'Needs evidence';
  const tone = hasDecisionEvidence ? 'pill-success' : 'pill-warn';
  const latestNote =
    input.operatorNoteLines[input.operatorNoteLines.length - 1] ??
    'No internal note has been added for manual decision context.';
  const summary = hasDecisionEvidence
    ? `Admin can review ${evidenceCount} retained evidence item(s) before changing booking outcome.`
    : hasPartialEvidence
      ? `Only part of the decision record is retained. Review the missing chat or operator note before changing the outcome.`
    : 'No chat, alert, location, or operator note evidence is attached yet; add a note before manual outcome changes.';
  const addressSnapshotLabel = safeAddressSnapshotLabel(input.addressSnapshotLabel);
  const addressEvidenceLabel = safeAddressSnapshotLabel(
    input.addressPinLabel ?? input.addressSnapshotLabel,
  );

  return {
    status,
    tone,
    summary,
    metrics: [
      {
        label: 'Chat evidence',
        value: input.messageCount > 0
          ? `${input.messageCount} message(s)`
          : input.chatRoomShortId
            ? 'Retained room · no messages'
            : 'No room',
        helper: input.messageCount > 0
          ? 'Matched booking messages are retained in admin even after mobile closeout.'
          : input.chatRoomShortId
            ? 'The room exists, but it contains no customer or Partner conversation evidence.'
          : 'Matched bookings should create a retained chat room before service handoff.',
      },
      {
        label: 'Location evidence',
        value: input.latestLocationAtLabel ?? `${input.locationTrailCount} row(s)`,
        dateTimeValue: input.latestLocationAtValue,
        helper: partnerLocationMetricHelper(input.latestLocationCoordinateLabel),
      },
      {
        label: 'Payment evidence',
        value: input.paymentStatus,
        helper: `${input.paymentMethod} / ${input.paymentAmountLabel}`,
      },
      {
        label: 'Refund evidence',
        value: input.refundRows.length
          ? `${input.refundRows.length} refund row(s)`
          : refundExpected(input)
            ? 'Missing refund row'
            : 'Not expected',
        helper: input.refundRows.length
          ? input.refundRows.map((row) => `${row.status} ${row.amountLabel}`).join(', ')
          : refundExpected(input)
            ? 'Captured customer funds require a refund record or Finance follow-up.'
            : 'This payment path does not require a refund record.',
      },
      {
        label: 'Alert evidence',
        value: `${input.alertCount} alert(s)`,
        helper: `${input.failedAlertCount} failed delivery row(s), ${input.marketplaceBatchCount} marketplace batch(es).`,
      },
      {
        label: 'Operator note evidence',
        value: `${input.operatorNoteLines.length} note(s)`,
        helper: latestNote,
      },
    ],
    records: [
      {
        id: 'address-evidence',
        label: 'Address',
        title: 'Address evidence',
        detail: input.hasAddressSnapshot
          ? `Confirmed service address: ${addressSnapshotLabel}.`
          : 'No confirmed service address is attached yet.',
        evidence: input.hasAddressSnapshot
          ? ['Confirmed service address', addressEvidenceLabel].join(' ')
          : 'Stored-address fallback or missing booking address needs operator review.',
        href: '#address-radius-contract',
      },
      {
        id: 'chat-evidence',
        label: 'Chat',
        title: 'Chat evidence',
        detail: input.chatReady
          ? `Room ${input.chatRoomShortId ?? 'missing'} keeps ${input.messageCount} retained message(s).`
          : 'No retained chat room is attached.',
        evidence: input.latestMessageAtLabel ?? 'No chat message evidence.',
        evidenceDateTimePrefix: input.latestMessageAtLabel ? 'Latest message: ' : undefined,
        evidenceDateTimeValue: input.latestMessageAtValue,
        href: '#chat',
      },
      {
        id: 'location-evidence',
        label: 'Location',
        title: 'Location evidence',
        detail: input.latestLocationCoordinateLabel
          ? `Latest Partner location is ${safePartnerLocationEvidenceLabel(
              input.latestLocationCoordinateLabel,
            )}.`
          : 'No Partner location has been retained.',
        evidence: input.latestLocationAtLabel ?? 'No location timestamp.',
        evidenceDateTimePrefix: input.latestLocationAtLabel ? 'Recorded ' : undefined,
        evidenceDateTimeValue: input.latestLocationAtValue,
        href: '#location',
      },
      {
        id: 'payment-evidence',
        label: 'Payment',
        title: 'Payment evidence',
        detail: `${input.paymentMethod} payment is ${input.paymentStatus}.`,
        evidence: `${input.customerPriceLabel} / ${input.walletLedgerLabel} wallet impact.`,
        href: '#payment',
      },
      {
        id: 'refund-evidence',
        label: 'Refund',
        title: 'Refund evidence',
        detail: input.refundRows.length
          ? `${input.refundRows.length} refund row(s) are attached to this booking.`
          : 'Refund record not attached.',
        evidence: input.refundEvidence,
        href: '#payment',
      },
      {
        id: 'alert-evidence',
        label: 'Alerts',
        title: 'Alert evidence',
        detail: `${input.alertCount} notification row(s) and ${input.marketplaceBatchCount} marketplace batch(es).`,
        evidence: input.failedAlertCount
          ? `${input.failedAlertCount} failed delivery row(s)`
          : 'No failed delivery row in this packet.',
        href: '#alerts',
      },
      {
        id: 'note-evidence',
        label: 'Notes',
        title: 'Operator note evidence',
        detail: input.operatorNoteLines.length
          ? 'Internal support notes are attached to this booking.'
          : 'No internal support note has been added yet.',
        evidence:
          input.operatorNoteLines[input.operatorNoteLines.length - 1] ??
          'Use operator notes before manual cancellation, no-show, or refund decisions.',
        href: '#operator-notes',
      },
      {
        id: 'ops-evidence',
        label: 'Ops',
        title: 'Operations evidence',
        detail: `${input.opsTaskCount} task row(s), ${input.auditLogCount} audit row(s).`,
        evidence:
          input.operatorNoteLines[input.operatorNoteLines.length - 1] ??
          'Use structured ops status and audit rows before manual outcome changes.',
        href: '#structured-ops-status',
      },
      {
        id: 'audit-evidence',
        label: 'Audit',
        title: 'Audit evidence',
        detail: `${input.auditLogCount} audit row(s), ${input.activityRecordCount} timeline event(s).`,
        evidence: input.latestActivityTitle && input.latestActivityAtLabel
          ? input.latestActivityAtLabel
          : 'No timeline event retained.',
        evidenceDateTimePrefix:
          input.latestActivityTitle && input.latestActivityAtLabel
            ? `Latest event: ${input.latestActivityTitle} / `
            : undefined,
        evidenceDateTimeValue: input.latestActivityAtValue,
        href: '#booking-activity',
      },
    ],
  };
}

function refundExpected(input: BookingEvidencePacketInput) {
  return input.paymentMethod.toUpperCase() !== 'CASH' && input.paymentStatus.toUpperCase() === 'CAPTURED';
}
