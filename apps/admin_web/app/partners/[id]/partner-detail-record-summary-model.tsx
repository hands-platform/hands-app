import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import {
  bookingLatestActivityAt,
  bookingRecordCreatedAt,
} from '../../../lib/admin-booking-time';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  type PartnerActivityRecord,
  partnerActivityRecordHref,
} from './partner-detail-activity-model';
import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import type { PartnerBookingOpsLedgerRow } from './partner-detail-booking-ops-ledger-section';
import type { PartnerDetailCommandSnapshotItem } from './partner-detail-command-snapshot-section';
import { orderPartnerActivityRecords } from './partner-detail-filters';
import {
  dateValue,
  formatDate,
  locationAgeLabel,
  shortRecordId,
} from './partner-detail-format';
import type { PartnerMasterFact } from './partner-detail-master-facts-section';
import {
  bookingClosureLabel,
  bookingServiceLabel,
  latestBookingManualNote,
  partnerBookingCustomer,
  readPartnerChatMessages,
  type PartnerDetailBooking,
} from './partner-detail-record-helpers';
import type { ProviderBankAccount, ProviderDetail } from './partner-detail-types';

type PartnerPayoutStatus = {
  readonly status: string;
};

type PartnerBookingAcceptanceSummary = {
  readonly bookableServices: string;
};

type PartnerDetailBookingArchiveRecord = PartnerBookingArchiveRecord<PartnerDetailBooking>;

export function latestPartnerAccessAt(provider: ProviderDetail) {
  return [
    provider.appActivitySummary?.lastActiveAt,
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
  ]
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];
}

export function buildPartnerActivityCommandSnapshot(
  provider: ProviderDetail,
  records: PartnerActivityRecord[],
  bookingArchive: PartnerDetailBookingArchiveRecord[],
  payoutOps: PartnerPayoutStatus,
  dateLabel: string,
  activityTypeLabel: string,
): PartnerDetailCommandSnapshotItem[] {
  const latestEvent = orderPartnerActivityRecords(records, 'newest')[0];
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED');
  const latestCompletedBooking = completedBookings[0]?.booking;
  const retainedChatRooms = bookingArchive.filter((record) => record.booking.chatRoom);
  const retainedMessageCount = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const joinedBookings = bookingArchive.filter((record) => record.relation === 'Joined').length;
  const selectedBookings = bookingArchive.filter((record) => record.relation === 'Selected').length;
  const preferredBookings = bookingArchive.filter((record) => record.relation === 'Preferred').length;
  const earningCount = provider.earnings?.length ?? 0;
  const payoutCount = provider.payoutBatches?.length ?? 0;
  const latestAccessAt = latestPartnerAccessAt(provider);
  const staffRecordCount =
    (provider.auditLogs?.length ?? 0) +
    (provider.verificationLogs?.length ?? 0) +
    (provider.reports?.length ?? 0) +
    (provider.sanctions?.length ?? 0);
  const latestStaffRecord = records.find((record) =>
    ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'].includes(
      record.type,
    ),
  );

  return [
    {
      label: 'Applied filter',
      value: `${records.length} event(s)`,
      helper: `${dateLabel} / ${activityTypeLabel}`,
      href: '#app-activity',
    },
    {
      label: 'Latest event',
      value: latestEvent ? latestEvent.title : 'No event',
      helper: latestEvent
        ? `${latestEvent.type} / ${formatDate(latestEvent.at)}`
        : 'No record in this filter.',
      helperNode: latestEvent ? (
        <>
          {latestEvent.type} / <DateTimeText fallback="Missing" value={latestEvent.at} />
        </>
      ) : undefined,
      href: latestEvent ? partnerActivityRecordHref(latestEvent) : '#app-activity',
    },
    {
      label: 'Completed work',
      value: `${completedBookings.length} booking(s)`,
      helper: latestCompletedBooking
        ? `Latest ${bookingServiceLabel(latestCompletedBooking)} / ${formatDate(
            bookingLatestActivityAt(latestCompletedBooking),
          )}`
        : 'No completed booking in this filter.',
      helperNode: latestCompletedBooking ? (
        <>
          Latest {bookingServiceLabel(latestCompletedBooking)} /{' '}
          <DateTimeText fallback="Missing" value={bookingLatestActivityAt(latestCompletedBooking)} />
        </>
      ) : undefined,
      href: latestCompletedBooking ? `/bookings/${latestCompletedBooking.id}` : '#partner-booking-journey',
    },
    {
      label: 'Retained chat',
      value: `${retainedMessageCount} message(s)`,
      helper: `${retainedChatRooms.length} room(s) retained for admin review.`,
      href: '#partner-chat-retention-ledger',
    },
    {
      label: 'Marketplace records',
      value: `${joinedBookings} participation record(s)`,
      helper: `${preferredBookings} preferred / ${selectedBookings} selected booking relation(s).`,
      href: '#partner-booking-journey',
    },
    {
      label: 'Finance rows',
      value: `${earningCount + payoutCount} row(s)`,
      helper: `${earningCount} earning / ${payoutCount} payout / ${payoutOps.status}.`,
      href: '#payout',
    },
    {
      label: 'Location and app',
      value: locationAgeLabel(provider.currentLocationUpdatedAt),
      helper: latestAccessAt
        ? `Recent app access ${formatDate(latestAccessAt)}`
        : 'No app access row loaded.',
      helperNode: latestAccessAt ? (
        <>
          Recent app access <DateTimeText fallback="Missing" value={latestAccessAt} />
        </>
      ) : undefined,
      href: '#location',
    },
    {
      label: 'Staff records',
      value: `${staffRecordCount} row(s)`,
      helper: latestStaffRecord
        ? `${latestStaffRecord.title} / ${formatDate(latestStaffRecord.at)}`
        : 'No staff record in this filter.',
      helperNode: latestStaffRecord ? (
        <>
          {latestStaffRecord.title} / <DateTimeText fallback="Missing" value={latestStaffRecord.at} />
        </>
      ) : undefined,
      href: '#partner-operator-notes',
    },
  ];
}

export function buildPartnerMasterFacts(
  provider: ProviderDetail,
  bookingArchive: PartnerDetailBookingArchiveRecord[],
  primaryBank: ProviderBankAccount | null,
  payoutOps: PartnerPayoutStatus,
  bookingAcceptance: PartnerBookingAcceptanceSummary,
  cashFeeDebtTotal: number,
): PartnerMasterFact[] {
  const earnings = provider.earnings ?? [];
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED').length;
  const cancelledBookings = bookingArchive.filter((record) =>
    ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(record.booking.status ?? ''),
  ).length;
  const totalRevenue = earnings.reduce((sum, earning) => sum + Number(earning.grossAmount ?? 0), 0);
  const platformFee = earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0);
  const payoutReadyAmount = earnings
    .filter((earning) => earning.status === 'AVAILABLE')
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
  const latestAccessAt = latestPartnerAccessAt(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const activeReports = (provider.reports ?? []).filter((report) => report.status !== 'RESOLVED');

  return [
    {
      label: 'Partner ID',
      value: provider.id,
      helper: 'Internal admin identifier',
    },
    {
      label: 'Real / activity name',
      value: `${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} / ${
        provider.activityNickname ?? provider.displayName ?? 'No activity name'
      }`,
      helper: `Display name: ${marketplaceDisplayText(provider.displayName ?? 'Not saved')}`,
    },
    {
      label: 'Phone / email',
      value: provider.user?.phone ?? 'No phone',
      helper: provider.user?.email ?? 'No email',
    },
    {
      label: 'Gender / birth',
      value: (
        <>
          {provider.gender ?? 'Not saved'} / <DateTimeText fallback="Missing" value={provider.dateOfBirth} />
        </>
      ),
      helper: 'Basic partner profile field',
    },
    {
      label: 'Address / city',
      value: provider.residentialAddress ?? 'Residential address not saved',
      helper: provider.city ?? 'City not saved',
    },
    {
      label: 'Joined / recent access',
      value: 'Missing',
      valueDateTimeFallback: 'Missing',
      valueDateTimeValue: provider.user?.createdAt,
      helper: latestAccessAt ? (
        <>
          Recent app access <DateTimeText fallback="No app session recorded" value={latestAccessAt} />
        </>
      ) : (
        'No app session recorded'
      ),
    },
    {
      label: 'Current state',
      value: provider.status,
      helper: `${enabledPushCount} enabled push device(s)`,
    },
    {
      label: 'Verification level',
      value: provider.level ?? 'LEVEL_1_SIGNUP',
      helper: `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}`,
    },
    {
      label: 'Services',
      value: bookingAcceptance.bookableServices,
      helper: 'Bookable service price rows against admin pricing policy',
    },
    {
      label: 'Location',
      value: locationAgeLabel(provider.currentLocationUpdatedAt),
      helper:
        provider.currentLat && provider.currentLng
          ? 'Latest Partner location saved for dispatch checks.'
          : 'No GPS pin',
    },
    {
      label: 'Bookings',
      value: `${bookingArchive.length} total`,
      helper: `${completedBookings} completed / ${cancelledBookings} cancelled`,
    },
    {
      label: 'Feedback records',
      value: `${provider.reviewCount ?? 0} feedback record(s)`,
      helper: 'Open the feedback section to read original customer feedback records',
    },
    {
      label: 'Revenue',
      value: <MoneyText amount={totalRevenue} />,
      helper: (
        <>
          Platform fee <MoneyText amount={platformFee} />
        </>
      ),
    },
    {
      label: 'Payout',
      value: payoutOps.status,
      helper: (
        <>
          Available <MoneyText amount={payoutReadyAmount} /> / cash debt{' '}
          <MoneyText amount={cashFeeDebtTotal} />
        </>
      ),
    },
    {
      label: 'Tax profile optional',
      value: provider.taxProfile?.status ?? 'DEFERRED',
      helper: 'Not required for Level 2 approval, matching, or current Vietnam payout review.',
    },
    {
      label: 'Withdrawal details',
      value: primaryBank?.status ?? 'MISSING',
      helper: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${marketplaceDisplayText(primaryBank.accountHolderName)}`
        : 'Collected when wallet withdrawal is requested',
    },
    {
      label: 'Account state',
      value: provider.blockedAt ? 'BLOCKED' : 'OPEN',
      helper: provider.blockedReason ?? 'No account block reason',
    },
    {
      label: 'Admin records',
      value: `${activeReports.length} open report(s) / ${activeSanctions.length} active control(s)`,
      helper: 'Factual admin records only',
    },
  ];
}

export function buildPartnerBookingOpsLedgerRows(
  records: PartnerDetailBookingArchiveRecord[],
): PartnerBookingOpsLedgerRow[] {
  return records
    .filter((record) => {
      const booking = record.booking;
      return (
        Boolean(booking.notes?.trim()) ||
        (booking.opsTasks?.length ?? 0) > 0 ||
        Boolean(booking.closedAt || booking.closedReason || booking.closedNote)
      );
    })
    .slice(0, 40)
    .map((record) => {
      const booking = record.booking;
      const tasks = [...(booking.opsTasks ?? [])].sort(
        (left, right) =>
          dateValue(right.updatedAt ?? right.createdAt) - dateValue(left.updatedAt ?? left.createdAt),
      );
      const latestTask = tasks[0];
      const latestNote = latestBookingManualNote(booking.notes);

      return {
        id: booking.id,
        relation: record.relation,
        bookingLabel: `${shortRecordId(booking.id)} / ${formatDate(bookingRecordCreatedAt(booking))}`,
        bookingLabelNode: (
          <>
            {shortRecordId(booking.id)} /{' '}
            <DateTimeText fallback="Missing" value={bookingRecordCreatedAt(booking)} />
          </>
        ),
        serviceLabel: `${bookingServiceLabel(booking)} / customer ${partnerBookingCustomer(booking)}`,
        status: booking.status ?? 'UNKNOWN',
        noteStatus: latestNote ? 'Manual note saved' : 'No manual note',
        noteDetail: latestNote ?? 'No booking-level staff note has been saved for this booking.',
        taskStatus: tasks.length ? `${tasks.length} task row(s)` : 'No staff task',
        taskDetail: latestTask
          ? `${latestTask.status} ${latestTask.type} / ${latestTask.note ?? 'No task note'} / ${
              latestTask.actor?.fullName ?? latestTask.actor?.phone ?? 'System'
            }`
          : 'No linked booking operation task is loaded.',
        closeoutStatus: booking.closedAt ? 'Closed by operator flow' : 'Not closed',
        closeoutDetail: booking.closedAt
          ? `${formatDate(booking.closedAt)} / ${bookingClosureLabel(booking)}`
          : 'No cancellation, no-show, refund, or closeout decision is saved.',
        closeoutDetailNode: booking.closedAt ? (
          <>
            <DateTimeText fallback="Missing" value={booking.closedAt} /> / {bookingClosureLabel(booking)}
          </>
        ) : undefined,
        chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      };
    });
}
