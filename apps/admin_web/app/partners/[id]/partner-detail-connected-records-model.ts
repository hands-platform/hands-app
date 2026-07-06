import type { AdminAuditLog } from '../../../lib/admin-api';
import type { PartnerBookingArchiveBooking, PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import { auditLogNoteText } from './partner-detail-record-helpers';
import { dateValue, formatDate, shortRecordId } from './partner-detail-format';
import { partnerOpsPillClass, type PartnerOpsTone } from './partner-detail-tone';

const PARTNER_OPS_NOTE_ACTION = 'provider.ops_note.add';

export type PartnerDetailConnectedRecordLink = {
  readonly detail: string;
  readonly detailDateTimePrefix?: string;
  readonly detailDateTimeValue?: string | null;
  readonly href: string;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
  readonly valueDateTimeValue?: string | null;
};

type PartnerConnectedRecordProvider = {
  readonly auditLogs?: readonly AdminAuditLog[] | null;
  readonly currentLat?: string | number | null;
  readonly currentLng?: string | number | null;
  readonly currentLocationUpdatedAt?: string | null;
  readonly id: string;
  readonly kyc?: { readonly status?: string | null } | null;
  readonly verification?: { readonly status?: string | null } | null;
};

type PartnerConnectedRecordPayoutOps = {
  readonly blockers: readonly string[];
  readonly hold?: { readonly reason?: string | null } | null;
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

type PartnerConnectedRecordKycEvidence = {
  readonly missingDocuments: readonly string[];
};

type PartnerConnectedRecordGateAttempt = {
  readonly at: string;
  readonly bookingMonitorHref?: string;
  readonly reasonLabel: string;
};

export function buildPartnerConnectedRecordLinks<TBooking extends PartnerBookingArchiveBooking>({
  provider,
  bookingArchive,
  bookingGateAttempts,
  kycEvidence,
  canApproveKyc,
  payoutOps,
}: {
  readonly provider: PartnerConnectedRecordProvider;
  readonly bookingArchive: readonly PartnerBookingArchiveRecord<TBooking>[];
  readonly bookingGateAttempts: readonly PartnerConnectedRecordGateAttempt[];
  readonly kycEvidence: PartnerConnectedRecordKycEvidence;
  readonly canApproveKyc: boolean;
  readonly payoutOps: PartnerConnectedRecordPayoutOps;
}): PartnerDetailConnectedRecordLink[] {
  const latestBooking = bookingArchive[0]?.booking;
  const chatMessageCount = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const chatRoomCount = bookingArchive.filter((record) => record.booking.chatRoom).length;
  const partnerOpsNotes = (provider.auditLogs ?? []).filter((log) => log.action === PARTNER_OPS_NOTE_ACTION);
  const latestLocationSaved =
    provider.currentLat !== null &&
    provider.currentLat !== undefined &&
    provider.currentLng !== null &&
    provider.currentLng !== undefined;

  return [
    {
      label: 'Latest booking',
      value: latestBooking ? shortRecordId(latestBooking.id) : 'None',
      detail: latestBooking
        ? `${latestBooking.status ?? 'UNKNOWN'} / ${bookingServiceLabel(latestBooking)}`
        : 'No preferred, selected, or marketplace participation booking loaded.',
      href: latestBooking ? `/bookings/${latestBooking.id}` : '#booking-chat-records',
      tone: latestBooking ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'First-pick gate attempts',
      value: `${bookingGateAttempts.length} attempt(s)`,
      detail: bookingGateAttempts[0]
        ? `${bookingGateAttempts[0].reasonLabel} / latest ${formatDate(bookingGateAttempts[0].at)}`
        : 'No booking create gate attempt is linked to this partner.',
      detailDateTimePrefix: bookingGateAttempts[0] ? `${bookingGateAttempts[0].reasonLabel} / latest ` : undefined,
      detailDateTimeValue: bookingGateAttempts[0]?.at,
      href: bookingGateAttempts[0]?.bookingMonitorHref ?? '/bookings?view=blocked-create',
      tone: bookingGateAttempts.length ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Chat archive',
      value: `${chatMessageCount} message(s)`,
      detail: `${chatRoomCount} retained room(s).`,
      href: `/chat-archive?q=${encodeURIComponent(provider.id)}`,
      tone: chatRoomCount ? 'pill-success' : 'pill-neutral',
    },
    {
      label: 'KYC and documents',
      value: provider.kyc?.status ?? provider.verification?.status ?? 'DRAFT',
      detail: `${kycEvidence.missingDocuments.length} required document(s) missing approval.`,
      href: '#kyc',
      tone: canApproveKyc ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Location',
      value: provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : 'No pin',
      valueDateTimeValue: provider.currentLocationUpdatedAt,
      detail: latestLocationSaved
        ? 'Latest Partner location saved for dispatch checks.'
        : 'No latest location loaded.',
      href: '#location',
      tone: provider.currentLocationUpdatedAt ? 'pill-info' : 'pill-warn',
    },
    {
      label: 'Wallet and payout',
      value: payoutOps.status,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate clear or deferred.',
      href: '#payout',
      tone: partnerOpsPillClass(payoutOps.tone),
    },
    {
      label: 'Operator notes',
      value: `${partnerOpsNotes.length} note(s)`,
      detail: partnerOpsNotes[0] ? auditLogNoteText(partnerOpsNotes[0]) : 'No manual partner note saved.',
      href: '#partner-operator-notes',
      tone: partnerOpsNotes.length ? 'pill-info' : 'pill-neutral',
    },
  ];
}

function readPartnerChatMessages(booking: PartnerBookingArchiveBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

function bookingServiceLabel(booking: PartnerBookingArchiveBooking) {
  const labels = (booking.services ?? [])
    .map((item) => {
      const name = item.service?.name ?? 'Service';
      const duration = item.service?.durationMin ? ` ${item.service.durationMin}m` : '';
      return `${name}${duration}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service';
}
