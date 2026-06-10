type EvidenceBundleTone = 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';

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
  serviceAddressPinLabel: string;
  notificationCount: number;
  failedAlertCount: number;
  partnerAlertCount: number;
  marketplaceBatchCount: number;
  activityRecordCount: number;
  latestActivityEvidenceLabel?: string | null;
  latestOperatorNote?: string | null;
};

export type BookingEvidenceBundleRow = {
  lane: string;
  recordLabel: string;
  status: string;
  tone: EvidenceBundleTone;
  evidence: string;
  operatorUse: string;
  href: string;
};

export function bookingEvidenceBundleRows(
  input: BookingEvidenceBundleRowsInput,
): BookingEvidenceBundleRow[] {
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
      recordLabel: input.addressReady ? 'BookingAddressSnapshot' : 'Snapshot missing',
      status: input.addressReady ? 'Locked' : 'Repair needed',
      tone: input.addressReady ? 'pill-success' : 'pill-danger',
      evidence: `${input.addressLabel} / ${input.addressSourceLabel}`,
      operatorUse: 'Use this immutable address snapshot for partner radius checks and service evidence.',
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
        ? input.finalPartnerEvidenceLabel ?? 'Selected partner evidence missing'
        : `${input.participantCount} participant row(s), ${input.customerChoiceCandidates} customer-selectable row(s)`,
      operatorUse: 'Confirm the customer final partner selection and marketplace/payout settlement requirements.',
      href: input.finalPartnerId ? `/partners/${input.finalPartnerId}` : '#participants',
    },
    {
      lane: 'Chat',
      recordLabel: input.chatReady ? input.chatRoomShortId ?? 'missing' : 'No room',
      status: input.chatReady ? 'Archived' : 'Missing',
      tone: input.chatReady ? 'pill-success' : 'pill-warn',
      evidence: input.chatReady
        ? `${input.chatMessageCount} retained message(s), latest ${
            input.latestChatMessageAtLabel ?? 'none'
          }`
        : input.chatRepairNeeded
          ? 'Matched booking should have a retained chat archive.'
          : 'Chat opens after first-pick match or customer final selection.',
      operatorUse: 'Use the transcript for service handoff, cancellation, no-show, and refund context.',
      href: input.chatReady ? `/chat-archive?q=${encodeURIComponent(input.bookingId)}` : '#chat',
    },
    {
      lane: 'Money',
      recordLabel: input.paymentShortId ?? 'No payment row',
      status: input.hasMoneyTrace ? input.moneyStatus : 'Missing',
      tone: input.hasMoneyTrace ? 'pill-info' : 'pill-warn',
      evidence: `${input.paymentMethod} / customer ${input.customerPriceLabel} / partner ${input.partnerPayoutLabel} / wallet ${input.walletLedgerLabel}`,
      operatorUse: 'Check payment, earning, tax, fee, refund, payout, and cash settlement records together.',
      href: '#finance',
    },
    {
      lane: 'Location',
      recordLabel: input.latestLocationShortId ?? 'No latest pin',
      status: input.hasLocationTrace ? input.locationStatusLabel : 'Missing',
      tone: input.hasLocationTrace ? 'pill-info' : 'pill-neutral',
      evidence: input.latestLocationEvidenceLabel ?? `Service address pin ${input.serviceAddressPinLabel}`,
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
      evidence: `${input.partnerAlertCount} partner alert(s), ${input.marketplaceBatchCount} marketplace batch(es)`,
      operatorUse:
        'Check whether customer and partner app notifications were created, delivered, read, or retried.',
      href: `/notifications?booking=${encodeURIComponent(input.bookingId)}`,
    },
    {
      lane: 'Operator trail',
      recordLabel: `${input.activityRecordCount} event(s)`,
      status: input.latestOperatorNote || input.latestActivityEvidenceLabel ? 'Retained' : 'Empty',
      tone: input.latestOperatorNote || input.latestActivityEvidenceLabel ? 'pill-success' : 'pill-neutral',
      evidence:
        input.latestActivityEvidenceLabel ?? input.latestOperatorNote ?? 'No operator trail loaded',
      operatorUse: 'Use notes and audit rows before manual closeout, no-show, refund, or settlement actions.',
      href: '#booking-activity',
    },
  ];
}
