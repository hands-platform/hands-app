import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { bookingRecordCreatedAt } from '../../../lib/admin-booking-time';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import type { PartnerActivityRecord } from './partner-detail-activity-model';
import {
  type PartnerBookingArchiveRecord as PartnerBookingArchiveModelRecord,
} from './partner-detail-booking-model';
import { buildPartnerBookingGateAttemptRows } from './partner-detail-booking-gate-rows-model';
import {
  dateValue,
  formatCurrency,
  formatDate,
  maskDeviceId,
  providerPublicMediaLabel,
  shortRecordId,
} from './partner-detail-format';
import {
  auditLogNoteText,
  bookingClosureLabel,
  bookingServiceLabel,
  isClosedPartnerBooking,
  latestBookingManualNote,
  partnerBookingCustomer,
  trimText,
  type PartnerDetailBooking,
} from './partner-detail-record-helpers';
import type { ProviderDetail } from './partner-detail-types';
import { providerDocumentLabel } from '../../../lib/admin-api';

type PartnerBookingArchiveRecord = PartnerBookingArchiveModelRecord<PartnerDetailBooking>;

export function buildPartnerActivityRecords(
  provider: ProviderDetail,
  bookings: PartnerBookingArchiveRecord[],
): PartnerActivityRecord[] {
  const records: PartnerActivityRecord[] = [];

  if (provider.user?.createdAt) {
    records.push({
      id: provider.user.id ?? provider.id,
      type: 'ACCOUNT',
      at: provider.user.createdAt,
      title: 'Partner user account created',
      detail: `${marketplaceDisplayText(provider.legalName ?? provider.displayName ?? 'Unnamed partner')} / ${
        provider.user.phone ?? 'No phone'
      }`,
    });
  }

  for (const bookingRecord of bookings) {
    records.push({
      id: bookingRecord.booking.id,
      type: 'BOOKING',
      at: bookingRecordCreatedAt(bookingRecord.booking) ?? '',
      title: `${bookingRecord.relation} booking ${shortRecordId(bookingRecord.booking.id)}`,
      detail: `${bookingServiceLabel(bookingRecord.booking)} / ${
        bookingRecord.booking.status ?? 'UNKNOWN'
      } / customer ${partnerBookingCustomer(bookingRecord.booking)}${
        isClosedPartnerBooking(bookingRecord.booking)
          ? ` / ${bookingClosureLabel(bookingRecord.booking)}`
          : ''
      }`,
    });
    if (isClosedPartnerBooking(bookingRecord.booking) && bookingRecord.booking.closedAt) {
      records.push({
        id: `${bookingRecord.booking.id}-closure`,
        type: 'BOOKING',
        at: bookingRecord.booking.closedAt,
        title: `Booking closed ${shortRecordId(bookingRecord.booking.id)}`,
        detail: bookingClosureLabel(bookingRecord.booking),
      });
    }
    if (bookingRecord.booking.chatRoom?.messages?.[0]) {
      const message = bookingRecord.booking.chatRoom.messages[0];
      records.push({
        id: message.id,
        type: 'CHAT',
        at: message.createdAt ?? bookingRecord.booking.createdAt ?? '',
        title: `Chat message in ${shortRecordId(bookingRecord.booking.id)}`,
        detail: `${
          message.sender?.fullName ??
          message.sender?.phone ??
          message.sender?.roles?.join(', ') ??
          'Unknown'
        }: ${trimText(message.body, 90)}`,
      });
    }
    for (const task of bookingRecord.booking.opsTasks ?? []) {
      records.push({
        id: task.id,
        type: 'OPS',
        at: task.updatedAt ?? task.createdAt ?? bookingRecord.booking.updatedAt ?? '',
        title: `${task.status} booking task`,
        detail: `${task.type} / ${task.note ?? 'No note'} / ${
          task.actor?.fullName ?? task.actor?.phone ?? 'System'
        }`,
      });
    }
    const latestNote = latestBookingManualNote(bookingRecord.booking.notes);
    if (latestNote) {
      records.push({
        id: `${bookingRecord.booking.id}-booking-note`,
        type: 'OPS',
        at: bookingRecord.booking.updatedAt ?? bookingRecord.booking.createdAt ?? '',
        title: `Booking note ${shortRecordId(bookingRecord.booking.id)}`,
        detail: latestNote,
      });
    }
  }

  if (provider.verification?.submittedAt) {
    records.push({
      id: `${provider.verification.id}-submitted`,
      type: 'VERIFY',
      at: provider.verification.submittedAt,
      title: 'Partner verification submitted',
      detail: `${provider.verification.status} / ${
        provider.verification.files?.length ?? 0
      } attached file(s)`,
    });
  }

  if (provider.verification?.reviewedAt) {
    records.push({
      id: `${provider.verification.id}-reviewed`,
      type: 'VERIFY',
      at: provider.verification.reviewedAt,
      title: `Partner verification ${provider.verification.status.toLowerCase()}`,
      detail: provider.verification.rejectionReason ?? 'Admin review recorded.',
    });
  }

  if (provider.kyc?.submittedAt) {
    records.push({
      id: `${provider.kyc.id}-submitted`,
      type: 'VERIFY',
      at: provider.kyc.submittedAt,
      title: 'KYC evidence submitted',
      detail: `${provider.kyc.status} / CCCD last four ${
        provider.kyc.cccdNumberLast4 ? `****${provider.kyc.cccdNumberLast4}` : 'not stored'
      }`,
    });
  }

  if (provider.kyc?.reviewedAt) {
    records.push({
      id: `${provider.kyc.id}-reviewed`,
      type: 'VERIFY',
      at: provider.kyc.reviewedAt,
      title: `KYC ${provider.kyc.status.toLowerCase()}`,
      detail: provider.kyc.rejectionReason ?? 'KYC review recorded.',
    });
  }

  for (const document of provider.documents ?? []) {
    records.push({
      id: document.id,
      type: 'DOCUMENT',
      at: document.reviewedAt ?? document.fileAsset?.uploadedAt ?? '',
      title: `${providerDocumentLabel(document.type)} ${document.status.toLowerCase()}`,
      detail: `${document.fileAsset?.uploadStatus ?? 'No upload status'}${
        document.rejectionReason ? ` / ${document.rejectionReason}` : ''
      }`,
    });
  }

  for (const file of provider.user?.fileAssets ?? []) {
    records.push({
      id: file.id,
      type: 'PROFILE',
      at: file.reviewedAt ?? file.uploadedAt ?? file.createdAt ?? '',
      title: `${providerPublicMediaLabel(file.purpose)} ${
        file.reviewStatus ?? file.uploadStatus ?? 'recorded'
      }`,
      detail: `${file.visibility} / ${file.contentType}${
        file.reviewReason ? ` / ${file.reviewReason}` : ''
      }`,
    });
  }

  for (const bankAccount of provider.bankAccounts ?? []) {
    records.push({
      id: bankAccount.id,
      type: 'BANK',
      at: bankAccount.reviewedAt ?? '',
      title: `Bank account ${bankAccount.status.toLowerCase()}`,
      detail: `${marketplaceDisplayText(bankAccount.bankName)} / ${marketplaceDisplayText(
        bankAccount.accountHolderName,
      )} / ${bankAccount.isPrimary ? 'primary' : 'secondary'}${
        bankAccount.rejectionReason ? ` / ${bankAccount.rejectionReason}` : ''
      }`,
    });
  }

  if (provider.taxProfile?.approvedAt) {
    records.push({
      id: provider.taxProfile.id,
      type: 'TAX',
      at: provider.taxProfile.approvedAt,
      title: `Optional tax profile ${provider.taxProfile.status.toLowerCase()}`,
      detail: `${marketplaceDisplayText(provider.taxProfile.legalName)} / tax code ${
        provider.taxProfile.taxCodeLast4 ? `****${provider.taxProfile.taxCodeLast4}` : 'not stored'
      }`,
    });
  }

  for (const agreement of provider.agreements ?? []) {
    records.push({
      id: agreement.id,
      type: 'AGREEMENT',
      at: agreement.acceptedAt,
      title: `${agreement.type} accepted`,
      detail: `Version ${agreement.version}`,
    });
  }

  for (const session of provider.sessions ?? []) {
    records.push({
      id: session.id,
      type: 'SESSION',
      at: session.lastSeenAt ?? session.loggedInAt ?? '',
      title: `Partner app session ${session.suspicious ? 'check saved' : 'recorded'}`,
      detail: `IP ${session.ipAddress ?? 'missing'} / app ${
        session.appVersion ?? 'unknown'
      } / device ${maskDeviceId(session.deviceId)}`,
    });
  }

  for (const device of provider.devices ?? []) {
    records.push({
      id: device.id,
      type: 'DEVICE',
      at: device.lastSeenAt ?? device.updatedAt ?? device.createdAt ?? '',
      title: `Device ${device.blockedAt ? 'blocked' : device.enabled ? 'enabled' : 'disabled'}`,
      detail: `${device.platform ?? 'unknown platform'} / ${maskDeviceId(device.deviceId)}${
        device.blockReason ? ` / ${device.blockReason}` : ''
      }`,
    });
  }

  for (const snapshot of provider.locationSnapshots ?? []) {
    records.push({
      id: snapshot.id,
      type: 'LOCATION',
      at: snapshot.recordedAt,
      title: 'Location record',
      detail: `${snapshot.lat}, ${snapshot.lng}`,
    });
  }

  for (const earning of provider.earnings ?? []) {
    records.push({
      id: earning.id,
      type: 'EARNING',
      at: earning.createdAt ?? earning.availableAt ?? earning.paidAt ?? '',
      title: `${earning.status} earning ${shortRecordId(earning.id)}`,
      detail: `Gross ${formatCurrency(earning.grossAmount)} / platform fee ${formatCurrency(
        earning.platformFee,
      )} / net ${formatCurrency(earning.netAmount)}`,
      detailNode: (
        <>
          Gross <MoneyText amount={earning.grossAmount} /> / platform fee{' '}
          <MoneyText amount={earning.platformFee} /> / net <MoneyText amount={earning.netAmount} />
        </>
      ),
    });
  }

  for (const batch of provider.payoutBatches ?? []) {
    records.push({
      id: batch.id,
      type: 'PAYOUT',
      at: batch.createdAt ?? batch.paidAt ?? '',
      title: `${batch.status} payout batch ${shortRecordId(batch.id)}`,
      detail: `${formatCurrency(batch.totalNetAmount)}${
        batch.transferRef ? ` / ${batch.transferRef}` : ''
      }`,
      detailNode: (
        <>
          <MoneyText amount={batch.totalNetAmount} />
          {batch.transferRef ? ` / ${batch.transferRef}` : ''}
        </>
      ),
    });
  }

  for (const report of provider.reports ?? []) {
    records.push({
      id: report.id,
      type: 'REPORT',
      at: report.createdAt,
      title: `${report.status} report ${report.category}`,
      detail: `${report.source} / ${report.summary}`,
    });
  }

  for (const sanction of provider.sanctions ?? []) {
    records.push({
      id: sanction.id,
      type: 'SANCTION',
      at: sanction.createdAt ?? sanction.startsAt ?? '',
      title: `${sanction.status} ${sanction.type}`,
      detail: `${sanction.reason}${
        sanction.liftedAt ? ` / lifted ${formatDate(sanction.liftedAt)}` : ''
      }${sanction.expiresAt ? ` / expires ${formatDate(sanction.expiresAt)}` : ''}`,
      detailNode: (
        <>
          {sanction.reason}
          {sanction.liftedAt ? (
            <>
              {' '}
              / lifted <DateTimeText fallback="Missing" value={sanction.liftedAt} />
            </>
          ) : null}
          {sanction.expiresAt ? (
            <>
              {' '}
              / expires <DateTimeText fallback="Missing" value={sanction.expiresAt} />
            </>
          ) : null}
        </>
      ),
    });
  }

  for (const log of provider.verificationLogs ?? []) {
    records.push({
      id: log.id,
      type: 'VERIFY',
      at: log.createdAt,
      title: log.action,
      detail: `${log.fromStatus ?? 'none'} -> ${
        log.toStatus ?? 'none'
      } / ${marketplaceDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'system')}`,
    });
  }

  for (const log of provider.auditLogs ?? []) {
    const bookingGateAttempt =
      log.action === 'booking.create.rejected'
        ? buildPartnerBookingGateAttemptRows([log], provider.id)[0]
        : null;
    records.push({
      id: log.id,
      type: 'OPS',
      at: log.createdAt,
      title: bookingGateAttempt
        ? `Booking create stopped: ${bookingGateAttempt.reasonLabel}`
        : log.action,
      detail: bookingGateAttempt
        ? `${bookingGateAttempt.gateLabel} / ${bookingGateAttempt.detail}`
        : `${marketplaceDisplayText(
            log.actor?.fullName ?? log.actor?.phone ?? 'System',
          )} / ${auditLogNoteText(log)}`,
      detailNode: bookingGateAttempt ? (
        <>
          {bookingGateAttempt.gateLabel} / {bookingGateAttempt.detailNode}
        </>
      ) : undefined,
    });
  }

  return records
    .filter((record) => Number.isFinite(dateValue(record.at)))
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
}
