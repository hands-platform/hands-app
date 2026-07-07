import { bookingChatOpensAfterMatchOrSelectionCopy } from './booking-chat-copy';

type EvidenceBundleTone = 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';

const COORDINATE_PAIR_TEXT_RE = /\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b/;

function safeLatestLocationEvidenceLabel(label?: string | null) {
  if (!label) {
    return null;
  }

  return label.replace(COORDINATE_PAIR_TEXT_RE, 'Latest Partner location saved');
}

function safeServiceAddressPinEvidence(label: string) {
  if (COORDINATE_PAIR_TEXT_RE.test(label)) {
    return 'Confirmed service address saved';
  }

  return ['Confirmed service address', label].join(' ');
}

export type BookingEvidenceBundleRowsInput = {
  bookingId: string;
  customerProfileId?: string | null;
  customerRecordLabel: string;
  customerEvidenceLabel: string;
  addressReady: boolean;
  addressLabel: string;
  addressSourceLabel: string;
  finalPartnerId?: string | null;
  finalPartnerRecordLabel: string;
  finalPartnerEvidenceLabel?: string | null;
  participantCount: number;
  customerChoiceCandidates: number;
  chatReady: boolean;
  chatRoomShortId?: string | null;
  chatMessageCount: number;
  latestChatMessageAtLabel?: string | null;
  latestChatMessageAtValue?: string | null;
  chatRepairNeeded: boolean;
  hasMoneyTrace: boolean;
  paymentShortId?: string | null;
  moneyStatus: string;
  paymentMethod: string;
  customerPriceLabel: string;
  partnerPayoutLabel: string;
  walletLedgerLabel: string;
  hasLocationTrace: boolean;
  latestLocationShortId?: string | null;
  locationStatusLabel: string;
  latestLocationEvidenceLabel?: string | null;
  latestLocationEvidenceDateTimeValue?: string | null;
  serviceAddressPinLabel: string;
  notificationCount: number;
  failedAlertCount: number;
  partnerAlertCount: number;
  marketplaceBatchCount: number;
  activityRecordCount: number;
  latestActivityEvidenceLabel?: string | null;
  latestActivityEvidenceDateTimeValue?: string | null;
  latestOperatorNote?: string | null;
};

export type BookingEvidenceBundleRow = {
  lane: string;
  recordLabel: string;
  status: string;
  tone: EvidenceBundleTone;
  evidence: string;
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
  operatorUse: string;
  href: string;
};

export function bookingEvidenceBundleRows(
  input: BookingEvidenceBundleRowsInput,
): BookingEvidenceBundleRow[] {
  const locationEvidence = dateTimeEvidenceFields(
    safeLatestLocationEvidenceLabel(input.latestLocationEvidenceLabel),
    input.latestLocationEvidenceDateTimeValue,
  );
  const operatorTrailEvidence = dateTimeEvidenceFields(
    input.latestActivityEvidenceLabel,
    input.latestActivityEvidenceDateTimeValue,
  );

  return [
    {
      lane: 'Customer',
      recordLabel: input.customerProfileId ? input.customerRecordLabel : 'Profile missing',
      status: input.customerProfileId ? 'Linked' : 'Missing',
      tone: input.customerProfileId ? 'pill-success' : 'pill-warn',
      evidence: input.customerEvidenceLabel,
      operatorUse:
        'Open the customer record to review bookings, wallet, addresses, and retained chat history.',
      href: input.customerProfileId ? `/customers/${input.customerProfileId}` : '#customer',
    },
    {
      lane: 'Address',
      recordLabel: input.addressReady ? 'Confirmed service address' : 'Address missing',
      status: input.addressReady ? 'Locked' : 'Repair needed',
      tone: input.addressReady ? 'pill-success' : 'pill-danger',
      evidence: `${input.addressLabel} / ${input.addressSourceLabel}`,
      operatorUse: 'Use this confirmed service address for Partner radius checks and service evidence.',
      href: '#address-radius-contract',
    },
    {
      lane: 'Partner',
      recordLabel: input.finalPartnerId ? input.finalPartnerRecordLabel : 'Selection pending',
      status: input.finalPartnerId ? 'Selected' : `${input.customerChoiceCandidates} selectable`,
      tone: input.finalPartnerId
        ? 'pill-success'
        : input.customerChoiceCandidates
          ? 'pill-warn'
          : 'pill-info',
      evidence: input.finalPartnerId
        ? input.finalPartnerEvidenceLabel ?? 'Selected Partner evidence missing'
        : `${input.participantCount} participant row(s), ${input.customerChoiceCandidates} customer-selectable row(s)`,
      operatorUse: 'Confirm the customer final Partner selection and marketplace/payout settlement requirements.',
      href: input.finalPartnerId ? `/partners/${input.finalPartnerId}` : '#participants',
    },
    {
      lane: 'Chat',
      recordLabel: input.chatReady ? input.chatRoomShortId ?? 'missing' : 'No room',
      status: input.chatReady ? 'Archived' : 'Missing',
      tone: input.chatReady ? 'pill-success' : 'pill-warn',
      evidence: input.chatReady && input.latestChatMessageAtLabel && input.latestChatMessageAtValue
        ? input.latestChatMessageAtLabel
        : input.chatReady
          ? `${input.chatMessageCount} retained message(s), latest ${
              input.latestChatMessageAtLabel ?? 'none'
            }`
        : input.chatRepairNeeded
          ? 'Matched booking should have a retained chat archive.'
          : bookingChatOpensAfterMatchOrSelectionCopy,
      evidenceDateTimePrefix: input.chatReady && input.latestChatMessageAtLabel && input.latestChatMessageAtValue
        ? `${input.chatMessageCount} retained message(s), latest `
        : undefined,
      evidenceDateTimeValue: input.latestChatMessageAtValue,
      operatorUse: 'Use the transcript for service handoff, cancellation, no-show, and refund context.',
      href: input.chatReady ? `/chat-archive?q=${encodeURIComponent(input.bookingId)}` : '#chat',
    },
    {
      lane: 'Money',
      recordLabel: input.paymentShortId ?? 'No payment row',
      status: input.hasMoneyTrace ? input.moneyStatus : 'Missing',
      tone: input.hasMoneyTrace ? 'pill-info' : 'pill-warn',
      evidence: `${input.paymentMethod} / customer ${input.customerPriceLabel} / Partner ${input.partnerPayoutLabel} / wallet ${input.walletLedgerLabel}`,
      operatorUse: 'Check payment, earning, tax, fee, refund, payout, and cash settlement records together.',
      href: '#finance',
    },
    {
      lane: 'Location',
      recordLabel: input.latestLocationShortId ?? 'No latest location',
      status: input.hasLocationTrace ? input.locationStatusLabel : 'Missing',
      tone: input.hasLocationTrace ? 'pill-info' : 'pill-neutral',
      evidence:
        locationEvidence?.evidence ??
        safeLatestLocationEvidenceLabel(input.latestLocationEvidenceLabel) ??
        safeServiceAddressPinEvidence(input.serviceAddressPinLabel),
      evidenceDateTimePrefix: locationEvidence?.evidenceDateTimePrefix,
      evidenceDateTimeValue: locationEvidence?.evidenceDateTimeValue,
      operatorUse:
        'Use location rows only as operational history; routing and live tracking are not required for MVP.',
      href: '#location',
    },
    {
      lane: 'Alerts',
      recordLabel: `${input.notificationCount} notification row(s)`,
      status: input.failedAlertCount ? `${input.failedAlertCount} failed` : 'Loaded',
      tone: input.failedAlertCount
        ? 'pill-warn'
        : input.notificationCount
          ? 'pill-info'
          : 'pill-neutral',
      evidence: `${input.partnerAlertCount} Partner alert(s), ${input.marketplaceBatchCount} marketplace batch(es)`,
      operatorUse:
        'Check whether customer and Partner app notifications were created, delivered, read, or retried.',
      href: `/notifications?booking=${encodeURIComponent(input.bookingId)}`,
    },
    {
      lane: 'Operator trail',
      recordLabel: `${input.activityRecordCount} event(s)`,
      status: input.latestOperatorNote || input.latestActivityEvidenceLabel ? 'Retained' : 'Empty',
      tone: input.latestOperatorNote || input.latestActivityEvidenceLabel ? 'pill-success' : 'pill-neutral',
      evidence:
        operatorTrailEvidence?.evidence ??
        input.latestActivityEvidenceLabel ??
        input.latestOperatorNote ??
        'No operator trail loaded',
      evidenceDateTimePrefix: operatorTrailEvidence?.evidenceDateTimePrefix,
      evidenceDateTimeValue: operatorTrailEvidence?.evidenceDateTimeValue,
      operatorUse: 'Use notes and audit rows before manual closeout, no-show, refund, or settlement actions.',
      href: '#booking-activity',
    },
  ];
}

function dateTimeEvidenceFields(label?: string | null, dateTimeValue?: string | null) {
  if (!label || !dateTimeValue) {
    return null;
  }

  const separatorIndex = label.lastIndexOf(' / ');

  if (separatorIndex < 0) {
    return {
      evidence: label,
      evidenceDateTimeValue: dateTimeValue,
    };
  }

  return {
    evidence: label.slice(separatorIndex + 3),
    evidenceDateTimePrefix: `${label.slice(0, separatorIndex)} / `,
    evidenceDateTimeValue: dateTimeValue,
  };
}
