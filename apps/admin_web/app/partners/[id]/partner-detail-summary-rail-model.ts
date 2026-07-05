import { Fragment, createElement } from 'react';
import type { ReactNode } from 'react';
import { bookingLatestActivityAt } from '../../../lib/admin-booking-time';
import { readAddressText, serviceAddressAreaLabel } from '../../bookings/booking-address-readers';
import { dateValue, formatDate } from './partner-detail-format';

export type PartnerDetailSummaryRailItem = {
  readonly detail: ReactNode;
  readonly href: string;
  readonly label: string;
  readonly value: ReactNode;
};

export type PartnerDetailUsageSummaryItem = {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerDetailUsageRegionSummary = {
  readonly helper: string;
  readonly items: readonly PartnerDetailUsageSummaryItem[];
  readonly regionRows: readonly PartnerDetailUsageSummaryItem[];
  readonly title: string;
};

type PartnerUsageBooking = {
  readonly address?: unknown;
  readonly addressSnapshot?: unknown;
  readonly createdAt?: string | null;
  readonly scheduledStartAt?: string | null;
  readonly serviceAddressText?: string | null;
  readonly updatedAt?: string | null;
  readonly [key: string]: unknown;
};

type PartnerUsageBookingArchiveRecord = {
  readonly booking: PartnerUsageBooking;
  readonly [key: string]: unknown;
};

type PartnerUsageSession = {
  readonly appVersion?: string | null;
  readonly lastSeenAt?: string | null;
  readonly [key: string]: unknown;
};

type PartnerUsageDevice = {
  readonly enabled?: boolean | null;
  readonly lastSeenAt?: string | null;
  readonly [key: string]: unknown;
};

export function buildPartnerOperatorFirstRead({
  backupRadiusMeters,
  bookingRecordCount,
  cashDebtLabel,
  chatMessageCount,
  chatRetentionRowCount,
  displayLabel,
  hasCashFeeDebt,
  joinedAtLabel,
  latestStaffNoteDetail,
  locationRecordedAtLabel,
  noteCount,
  payoutBlockerDetail,
  payoutStatus,
  responseWindowMinutes,
  userPhone,
  nextActionDetail,
  nextActionStatus,
}: {
  readonly backupRadiusMeters: number;
  readonly bookingRecordCount: number;
  readonly cashDebtLabel: ReactNode;
  readonly chatMessageCount: number;
  readonly chatRetentionRowCount: number;
  readonly displayLabel: string;
  readonly hasCashFeeDebt: boolean;
  readonly joinedAtLabel: string;
  readonly latestStaffNoteDetail?: string;
  readonly locationRecordedAtLabel?: string;
  readonly noteCount: number;
  readonly payoutBlockerDetail?: string;
  readonly payoutStatus: string;
  readonly responseWindowMinutes: number;
  readonly userPhone?: string | null;
  readonly nextActionDetail: string;
  readonly nextActionStatus: string;
}): PartnerDetailSummaryRailItem[] {
  return [
    {
      href: '#partner-master-facts',
      label: 'Identity',
      value: displayLabel,
      detail: `${userPhone ?? 'No phone'} / joined ${joinedAtLabel}`,
    },
    {
      href: '#partner-booking-journey',
      label: 'Booking flow',
      value: `${bookingRecordCount} records`,
      detail: `${partnerMarketplacePolicyDetail(responseWindowMinutes, backupRadiusMeters)} radius.`,
    },
    {
      href: '#cash-debt-origin',
      label: 'Cash fee gate',
      value: hasCashFeeDebt ? 'Acceptance blocked' : 'Clear',
      detail: hasCashFeeDebt
        ? createElement(
            Fragment,
            null,
            cashDebtLabel,
            ' company fee must be settled before final acceptance, service start, and payout release.',
          )
        : 'No unpaid cash fee debt is gating final acceptance, service start, or payout release.',
    },
    {
      href: '#partner-chat-retention-ledger',
      label: 'Retained chat',
      value: `${chatMessageCount} messages`,
      detail: `${chatRetentionRowCount} room(s) retained for admin review after completion.`,
    },
    {
      href: '#payout',
      label: 'Payout',
      value: payoutStatus,
      detail: payoutBlockerDetail ?? 'Payout gate clear or deferred.',
    },
    {
      href: '#partner-ops-command-center',
      label: 'Next action',
      value: nextActionStatus,
      detail: nextActionDetail,
    },
    {
      href: '#partner-operator-notes',
      label: 'Latest staff note',
      value: `${noteCount} note(s)`,
      detail: latestStaffNoteDetail ?? 'No manual partner note saved.',
    },
    {
      href: '#location',
      label: 'Location',
      value: locationRecordedAtLabel ? 'Recorded' : 'No pin',
      detail: locationRecordedAtLabel ?? 'No latest partner location loaded.',
    },
  ];
}

export function buildPartnerUsageRegionSummary({
  bookingArchive,
  devices = [],
  latestLocationRecordedAt,
  locationSnapshotCount,
  sessions = [],
}: {
  readonly bookingArchive: readonly PartnerUsageBookingArchiveRecord[];
  readonly devices?: readonly PartnerUsageDevice[];
  readonly latestLocationRecordedAt?: string | null;
  readonly locationSnapshotCount: number;
  readonly sessions?: readonly PartnerUsageSession[];
}): PartnerDetailUsageRegionSummary {
  const regionRows = buildPartnerBookingRegionRows(bookingArchive);
  const primaryRegion = regionRows[0]?.value === '0' ? null : regionRows[0];
  const latestSessionAt = newestValidDate(sessions.map((session) => session.lastSeenAt));
  const latestDeviceAt = newestValidDate(devices.map((device) => device.lastSeenAt));
  const enabledDeviceCount = devices.filter((device) => device.enabled === true).length;
  const appVersions = Array.from(new Set(
    sessions.map((session) => session.appVersion?.trim()).filter((value): value is string => Boolean(value)),
  ));
  const normalizedLocationCount = Math.max(0, locationSnapshotCount);

  return {
    helper: 'Built from stored app sessions, booking address snapshots, and Partner location timestamps. No live GPS polling.',
    items: [
      {
        detail: latestSessionAt
          ? `Latest ${formatDate(latestSessionAt)}${appVersions.length ? ` / ${appVersions.slice(0, 2).join(', ')}` : ''}.`
          : 'No Partner app session loaded.',
        label: 'App sessions',
        value: `${sessions.length}`,
      },
      {
        detail: primaryRegion
          ? 'Most common service area from stored booking addresses.'
          : 'No stored booking address area loaded.',
        label: 'Primary booking region',
        value: primaryRegion?.label ?? 'No booking region',
      },
      {
        detail: latestLocationRecordedAt
          ? `Latest Partner location timestamp ${formatDate(latestLocationRecordedAt)}.`
          : 'No Partner location snapshot loaded.',
        label: 'Location evidence',
        value: `${normalizedLocationCount} snapshot(s)`,
      },
      {
        detail: latestDeviceAt
          ? `${devices.length} device row(s) / latest ${formatDate(latestDeviceAt)}.`
          : `${devices.length} device row(s) / no latest device timestamp.`,
        label: 'Push/device reach',
        value: `${enabledDeviceCount} enabled`,
      },
    ],
    regionRows,
    title: 'Usage and region summary',
  };
}

export function buildPartnerOperationsQuickRail({
  activityRecordCount,
  activityTypeLabel,
  backupRadiusMeters,
  cashDebtLabel,
  chatRetentionRowCount,
  connectedRecordLinkCount,
  dateFilterLabel,
  missingKycDocumentCount,
  openCashDebtEarningCount,
  operationsDigestCount,
  payoutStatus,
  responseWindowMinutes,
  unpaidNetDetail,
  bookingJourneyRowCount,
}: {
  readonly activityRecordCount: number;
  readonly activityTypeLabel: string;
  readonly backupRadiusMeters: number;
  readonly cashDebtLabel: ReactNode;
  readonly chatRetentionRowCount: number;
  readonly connectedRecordLinkCount: number;
  readonly dateFilterLabel: string;
  readonly missingKycDocumentCount: number;
  readonly openCashDebtEarningCount: number;
  readonly operationsDigestCount: number;
  readonly payoutStatus: string;
  readonly responseWindowMinutes: number;
  readonly unpaidNetDetail?: string;
  readonly bookingJourneyRowCount: number;
}): PartnerDetailSummaryRailItem[] {
  return [
    {
      href: '#partner-operations-digest',
      label: 'Digest',
      value: `${operationsDigestCount} lanes`,
      detail: 'Identity, wallet, booking, location, payout, legacy finance, and app reachability.',
    },
    {
      href: '#partner-connected-operations-records',
      label: 'Linked records',
      value: `${connectedRecordLinkCount} links`,
      detail: 'Booking, chat, KYC, required documents, location, wallet, payout, and notes.',
    },
    {
      href: '#partner-booking-journey',
      label: 'Booking journey',
      value: `${bookingJourneyRowCount}`,
      detail: `${partnerMarketplacePolicyDetail(responseWindowMinutes, backupRadiusMeters)} policy.`,
    },
    {
      href: '#partner-chat-retention-ledger',
      label: 'Chat archive',
      value: `${chatRetentionRowCount}`,
      detail: 'Customer-final-selected chats retained for admin evidence.',
    },
    {
      href: '#cash-debt-origin',
      label: 'Cash debt',
      value: cashDebtLabel,
      detail: `${openCashDebtEarningCount} unpaid cash fee earning row(s). Final acceptance, service start, and payout release are blocked until settled.`,
    },
    {
      href: '#payout',
      label: 'Payout',
      value: payoutStatus,
      detail: unpaidNetDetail ?? 'No unpaid net.',
    },
    {
      href: '#documents',
      label: 'Documents',
      value: `${missingKycDocumentCount} missing`,
      detail: 'CCCD front/back, selfie, public profile, and typed onboarding files.',
    },
    {
      href: '#app-activity',
      label: 'Activity',
      value: `${activityRecordCount}`,
      detail: `${dateFilterLabel}, ${activityTypeLabel}.`,
    },
  ];
}

function partnerMarketplacePolicyDetail(responseWindowMinutes: number, backupRadiusMeters: number) {
  return `${responseWindowMinutes}m first-pick / ${Math.round(backupRadiusMeters / 1000)}km marketplace`;
}

function buildPartnerBookingRegionRows(
  bookingArchive: readonly PartnerUsageBookingArchiveRecord[],
): PartnerDetailUsageSummaryItem[] {
  const regionCounts = new Map<string, { count: number; latestAt: string | null }>();

  for (const record of bookingArchive) {
    const address = storedPartnerBookingAddressText(record.booking);
    if (!address) {
      continue;
    }

    const region = serviceAddressAreaLabel(address);
    if (!region) {
      continue;
    }

    const latestAt = bookingLatestActivityAt(record.booking);
    const previous = regionCounts.get(region);
    regionCounts.set(region, {
      count: (previous?.count ?? 0) + 1,
      latestAt: newestValidDate([previous?.latestAt, latestAt]),
    });
  }

  const rows = Array.from(regionCounts.entries())
    .sort((left, right) => {
      const countDelta = right[1].count - left[1].count;
      if (countDelta !== 0) {
        return countDelta;
      }
      return dateValue(right[1].latestAt) - dateValue(left[1].latestAt);
    })
    .slice(0, 3)
    .map(([label, stat]) => ({
      detail: stat.latestAt ? `Latest booking ${formatDate(stat.latestAt)}.` : 'No booking timestamp loaded.',
      label,
      value: `${stat.count}`,
    }));

  return rows.length
    ? rows
    : [
        {
          detail: 'No stored booking address area loaded.',
          label: 'No booking region',
          value: '0',
        },
      ];
}

function storedPartnerBookingAddressText(booking: PartnerUsageBooking) {
  return (
    readAddressText(booking.addressSnapshot) ??
    readAddressText(booking.address) ??
    readAddressText(booking.serviceAddressText)
  );
}

function newestValidDate(values: ReadonlyArray<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value) && !Number.isNaN(dateValue(value)))
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
}
