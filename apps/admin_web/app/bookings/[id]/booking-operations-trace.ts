import type { AdminAuditLog, AdminBookingDetail } from '../../../lib/admin-api';
import { readPlainRecord } from '../../../lib/admin-format';
import {
  bookingMatchAuditSource,
  bookingMatchAuditSummary,
} from '../../../lib/booking-match-audit';
import { formatDate, safeTime, shortId } from './booking-formatters';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';
import { readOptionalNumber, readOptionalString } from './booking-readers';

export function bookingOperationsTrace(booking: AdminBookingDetail, logs: AdminAuditLog[]) {
  const bookingTarget = `booking:${booking.id}`;
  const bookingCreatedAt = safeTime(booking.createdAt);
  const matchingPolicy = readBookingMatchingPolicySnapshot(booking);
  const hasSavedMatchingPolicy = Object.values(matchingPolicy).some((value) => value !== null);
  const bookingLogs = logs
    .filter((log) => log.target === bookingTarget || auditMetadataBookingId(log) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const policyLogsAfterOpen = logs
    .filter((log) => log.action === 'operational_policy.update')
    .filter((log) => isBookingRelevantPolicyKey(auditPolicyKey(log)))
    .filter((log) => bookingCreatedAt === 0 || safeTime(log.createdAt) >= bookingCreatedAt)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const manualLogs = bookingLogs.filter((log) => isManualBookingAuditAction(log.action));
  const paymentLogs = bookingLogs.filter(
    (log) => log.action.startsWith('payment.') || log.action.startsWith('earning.'),
  );
  const rows = [...bookingLogs, ...policyLogsAfterOpen]
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))
    .slice(0, 8)
    .map((log) => bookingOperationsTraceRow(log, booking.id));
  const status =
    manualLogs.length > 0
      ? 'Operator touched'
      : policyLogsAfterOpen.length > 0
        ? 'Policy changed'
        : hasSavedMatchingPolicy
          ? 'Policy saved'
          : 'Live policy default';
  const statusTone =
    manualLogs.length > 0 || policyLogsAfterOpen.length > 0
      ? 'pill-warn'
      : hasSavedMatchingPolicy
        ? 'pill-success'
        : 'pill-info';
  const title =
    manualLogs.length > 0
      ? 'Review manual handling before closing this booking'
      : policyLogsAfterOpen.length > 0
        ? 'Current policy changed after this booking opened'
        : hasSavedMatchingPolicy
          ? 'Booking has its own matching policy record'
          : 'Booking is using live policy default';
  const detail =
    manualLogs.length > 0
        ? 'This booking has operator actions in the audit log. Check notes, payment actions, no-show, expiry, or closeout before making another change.'
        : policyLogsAfterOpen.length > 0
        ? 'Matching uses the saved booking policy where available. Compare policy changes below before explaining behavior to customers or partners.'
        : hasSavedMatchingPolicy
          ? 'The saved response window, radius, accept mode, marketplace mode, and travel buffer are preserved for this booking.'
          : 'Older or seeded bookings may not have a stored policy record; operators should use the live policy panel above.';

  return {
    status,
    statusTone,
    title,
    detail,
    rows,
    metrics: [
      {
        label: 'Booking events',
        value: `${bookingLogs.length}`,
        helper: 'Audit rows linked by booking target or bookingId metadata.',
      },
      {
        label: 'Manual actions',
        value: `${manualLogs.length}`,
        helper: manualLogs.length ? 'Review before further intervention.' : 'No manual booking action captured.',
      },
      {
        label: 'Money actions',
        value: `${paymentLogs.length}`,
        helper: 'Payment, earning, cash debt, or payout audit rows linked to this booking.',
      },
      {
        label: 'Policy changes after open',
        value: `${policyLogsAfterOpen.length}`,
        helper: 'Relevant operations policy updates after this booking was created.',
      },
      {
        label: 'Policy basis',
        value: hasSavedMatchingPolicy ? 'Saved policy' : 'Live policy default',
        helper: hasSavedMatchingPolicy
          ? 'Booking behavior is explainable from saved metadata.'
          : 'Use live policy with extra caution.',
      },
    ],
  };
}

function bookingOperationsTraceRow(log: AdminAuditLog, bookingId: string) {
  const matchAudit = bookingMatchAuditSource(log);
  const policyKey = auditPolicyKey(log);
  const isPolicy = log.action === 'operational_policy.update';
  const isMoney = log.action.startsWith('payment.') || log.action.startsWith('earning.');
  const isManual = isManualBookingAuditAction(log.action);
  const targetBookingId = auditMetadataBookingId(log);
  const signal = matchAudit ? 'Match' : isPolicy ? 'Policy' : isMoney ? 'Money' : isManual ? 'Manual' : 'Trace';
  const signalClass = matchAudit
    ? 'signal-ok'
    : isPolicy || isManual
      ? 'signal-warn'
      : isMoney
        ? 'signal-info'
        : 'signal-ok';
  const actor = log.actor?.fullName ?? log.actor?.phone ?? 'System';

  return {
    id: log.id,
    signal,
    signalClass,
    title: `${matchAudit?.label ?? humanizeAuditAction(log.action)} / ${actor}`,
    detail: matchAudit
      ? matchAudit.detail
      : isPolicy
        ? `${policyKey ?? 'Operational policy'} changed after booking open; existing matching behavior should still follow the saved booking policy when present.`
        : `${log.target}${targetBookingId && targetBookingId !== bookingId ? ` / booking ${shortId(targetBookingId)}` : ''}`,
    meta: [formatDate(log.createdAt), bookingMatchAuditSummary(log) || auditMetadataSummary(log.metadata)]
      .filter(Boolean)
      .join(' / '),
  };
}

function auditMetadataBookingId(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.bookingId);
}

function auditPolicyKey(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.key);
}

function isBookingRelevantPolicyKey(key: string | null) {
  return Boolean(
    key &&
      (key.startsWith('matching.') ||
        key.startsWith('wallet.') ||
        key.startsWith('cancellation.') ||
        key.startsWith('no_show.') ||
        key.startsWith('notification.partner_')),
  );
}

function isManualBookingAuditAction(action: string) {
  return (
    action.startsWith('booking.') ||
    action.startsWith('payment.') ||
    action.startsWith('earning.') ||
    action.startsWith('refund.')
  );
}

export function humanizeAuditAction(action: string) {
  return action
    .split(/[._-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function auditMetadataSummary(metadata: unknown) {
  const data = readPlainRecord(metadata);
  if (!data) {
    return '';
  }
  const matchSource = readOptionalString(data.matchSource);
  const providerProfileId = readOptionalString(data.providerProfileId);

  const highlights = [
    readOptionalString(data.reason) ? `reason: ${readOptionalString(data.reason)}` : null,
    readOptionalString(data.key) ? `key: ${readOptionalString(data.key)}` : null,
    data.previousValue !== undefined ? `previous: ${compactAuditValue(data.previousValue)}` : null,
    data.value !== undefined ? `value: ${compactAuditValue(data.value)}` : null,
    readOptionalString(data.status) ? `status: ${readOptionalString(data.status)}` : null,
    readOptionalString(data.method) ? `method: ${readOptionalString(data.method)}` : null,
    readOptionalNumber(data.amount) !== null ? `amount: ${readOptionalNumber(data.amount)?.toLocaleString()}` : null,
    readOptionalString(data.note) ? `note: ${readOptionalString(data.note)}` : null,
    data.paymentReleased !== undefined ? `payment released: ${String(data.paymentReleased)}` : null,
    matchSource ? `match: ${matchSource}` : null,
    providerProfileId ? `partner: ${shortId(providerProfileId)}` : null,
  ].filter(Boolean);

  return highlights.slice(0, 4).join(' / ');
}

function compactAuditValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
