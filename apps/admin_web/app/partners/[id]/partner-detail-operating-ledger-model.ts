import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { providerDocumentLabel } from '../../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import type { PartnerBookingArchiveBooking, PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import { amountValue, dateValue, formatCurrency, locationAgeLabel } from './partner-detail-format';
import { buildPartnerDetailTargetHref } from './partner-detail-workspace-model';

const ACTIVE_BOOKING_STATUSES: readonly string[] = [
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
];

export type PartnerOperatingLedgerRow = {
  readonly area: string;
  readonly status: string;
  readonly evidence: string;
  readonly href: string;
};

type PartnerOperatingLedgerDocument = {
  readonly type?: string | null;
  readonly status?: string | null;
};

type PartnerOperatingLedgerEarning = {
  readonly booking?: {
    readonly payment?: { readonly method?: string | null } | null;
  } | null;
  readonly netAmount: number | string;
  readonly status: string;
};

type PartnerOperatingLedgerProvider = {
  readonly auditLogs?: readonly unknown[] | null;
  readonly city?: string | null;
  readonly currentLat?: string | number | null;
  readonly currentLng?: string | number | null;
  readonly currentLocationUpdatedAt?: string | null;
  readonly devices?: readonly unknown[] | null;
  readonly documents?: readonly PartnerOperatingLedgerDocument[] | null;
  readonly earnings?: readonly PartnerOperatingLedgerEarning[] | null;
  readonly id: string;
  readonly kyc?: { readonly status?: string | null } | null;
  readonly legalName?: string | null;
  readonly reports?: readonly unknown[] | null;
  readonly sanctions?: readonly unknown[] | null;
  readonly sessions?: readonly unknown[] | null;
  readonly user?: {
    readonly phone?: string | null;
    readonly pushDevices?: readonly { readonly enabled?: boolean | null }[] | null;
  } | null;
  readonly verification?: {
    readonly files?: readonly unknown[] | null;
    readonly status?: string | null;
  } | null;
  readonly verificationLogs?: readonly unknown[] | null;
};

type PartnerOperatingLedgerPayoutOps = {
  readonly blockers: readonly string[];
  readonly hold?: { readonly reason?: string | null } | null;
  readonly status: string;
};

type PartnerOperatingLedgerBookingAcceptance = {
  readonly primaryReason: string;
};

type PartnerOperatingLedgerServicePricing = {
  readonly readyCount: number;
  readonly rows: readonly unknown[];
};

export function buildPartnerOperatingLedger<TBooking extends PartnerBookingArchiveBooking>(
  provider: PartnerOperatingLedgerProvider,
  bookingArchive: readonly PartnerBookingArchiveRecord<TBooking>[],
  payoutOps: PartnerOperatingLedgerPayoutOps,
  bookingAcceptance: PartnerOperatingLedgerBookingAcceptance,
  providerServicePricing: PartnerOperatingLedgerServicePricing,
): PartnerOperatingLedgerRow[] {
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED').length;
  const activeBookings = bookingArchive.filter((record) =>
    ACTIVE_BOOKING_STATUSES.includes(record.booking.status ?? ''),
  ).length;
  const chatRooms = bookingArchive.filter((record) => record.booking.chatRoom).length;
  const chatMessages = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const missingKycDocs = missingApprovedRequiredKycDocuments(provider);
  const verificationFileCount = provider.verification?.files?.length ?? 0;
  const documentCount = provider.documents?.length ?? 0;
  const cashDebt = cashFeeDebtAmount(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const sessionCount = provider.sessions?.length ?? 0;
  const deviceCount = provider.devices?.length ?? 0;
  const latestLocationSaved =
    provider.currentLat !== null &&
    provider.currentLat !== undefined &&
    provider.currentLng !== null &&
    provider.currentLng !== undefined;
  const auditCount =
    (provider.auditLogs?.length ?? 0) +
    (provider.verificationLogs?.length ?? 0) +
    (provider.reports?.length ?? 0) +
    (provider.sanctions?.length ?? 0);

  return [
    {
      area: 'Identity',
      status: provider.legalName ? 'Profile linked' : 'Profile incomplete',
      evidence: `${marketplaceDisplayText(provider.legalName ?? 'No legal name')} / ${provider.user?.phone ?? 'No phone'} / ${
        provider.city ?? 'No city'
      }`,
      href: `/partners/${provider.id}?section=dossier&dossier=evidence`,
    },
    {
      area: 'KYC',
      status:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'KYC approved'
          : 'KYC review needed',
      evidence:
        missingKycDocs.length > 0
          ? `Missing: ${missingKycDocs.map(providerDocumentLabel).join(', ')}`
          : `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}`,
      href: `/partners/${provider.id}?section=dossier&dossier=evidence#documents`,
    },
    {
      area: 'Documents',
      status:
        verificationFileCount + documentCount
          ? `${verificationFileCount + documentCount} file(s)`
          : 'No files',
      evidence: `${documentCount} typed document(s) / ${verificationFileCount} verification file(s)`,
      href: `/partners/${provider.id}?section=dossier&dossier=evidence#documents`,
    },
    {
      area: 'Services',
      status: `${providerServicePricing.readyCount}/${providerServicePricing.rows.length} bookable`,
      evidence: 'Prices must match admin minimum, step policy, and payout rule lines.',
      href: buildPartnerDetailTargetHref(provider.id, 'service-pricing'),
    },
    {
      area: 'Bookings',
      status: `${bookingArchive.length} total`,
      evidence: `${activeBookings} active / ${completedBookings} completed / ${bookingAcceptance.primaryReason}`,
      href: `/partners/${provider.id}?section=bookings&bookings=journey`,
    },
    {
      area: 'Chat',
      status: `${chatRooms} room(s)`,
      evidence: `${chatMessages} retained message(s). Admin keeps archive after mobile chat hides.`,
      href: `/partners/${provider.id}?section=bookings&bookings=evidence`,
    },
    {
      area: 'Wallet',
      status: cashDebt > 0 ? 'Cash fee debt' : 'No cash fee block',
      evidence:
        cashDebt > 0
          ? `${formatCurrency(cashDebt)} unpaid company fee from cash booking flow.`
          : 'No negative cash-fee wallet state loaded.',
      href: `/partners/${provider.id}?section=dossier&dossier=finance`,
    },
    {
      area: 'Payout',
      status: payoutOps.status,
      evidence: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate clear or deferred.',
      href: `/partners/${provider.id}?section=dossier&dossier=finance`,
    },
    {
      area: 'Location',
      status: locationAgeLabel(provider.currentLocationUpdatedAt),
      evidence: latestLocationSaved
        ? 'Latest Partner location saved for dispatch checks.'
        : 'No current location pin saved.',
      href: `/partners/${provider.id}?section=access&access=readiness`,
    },
    {
      area: 'App devices',
      status: `${enabledPushCount} push-ready`,
      evidence: `${sessionCount} session(s) / ${deviceCount} device(s)`,
      href: `/partners/${provider.id}?section=access&access=diagnostics`,
    },
    {
      area: 'Admin trail',
      status: `${auditCount} record(s)`,
      evidence: `${provider.reports?.length ?? 0} report(s) / ${provider.sanctions?.length ?? 0} control row(s) / ${
        provider.auditLogs?.length ?? 0
      } audit row(s)`,
      href: `/partners/${provider.id}?section=control&control=records`,
    },
  ];
}

function readPartnerChatMessages(booking: PartnerBookingArchiveBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

function missingApprovedRequiredKycDocuments(provider: PartnerOperatingLedgerProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

function isCashFeeDebt(earning: PartnerOperatingLedgerEarning) {
  return amountValue(earning.netAmount) < 0 && earning.booking?.payment?.method === 'CASH' && earning.status !== 'PAID';
}

function cashFeeDebtAmount(provider: PartnerOperatingLedgerProvider) {
  return (provider.earnings ?? [])
    .filter(isCashFeeDebt)
    .reduce((total, earning) => total + Math.abs(amountValue(earning.netAmount)), 0);
}
