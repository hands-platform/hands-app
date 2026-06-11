import type { AdminBooking } from '../../lib/admin-api';
import {
  backupAlertTraceDisplayFromSummary,
  type BackupAlertTraceDisplay,
} from '../../lib/backup-alert-trace-display';
import { bookingAlertTraceSummaryFromMetadata } from '../../lib/booking-evidence-ops';

export type BookingAlertTraceSummaryWithAge = ReturnType<typeof bookingBackupAlertTraceSummary>;

export function bookingBackupAlertTraceLabel(booking: AdminBooking, nowMs: number) {
  return bookingBackupAlertTraceDisplay(booking, nowMs).label;
}

export function bookingBackupAlertTracePill(booking: AdminBooking) {
  return bookingBackupAlertTraceDisplay(booking).pill;
}

export function bookingBackupAlertTraceTone(booking: AdminBooking) {
  return bookingBackupAlertTraceDisplay(booking).tone;
}

export function bookingBackupAlertTraceDisplay(
  booking: AdminBooking,
  nowMs = 0,
): BackupAlertTraceDisplay {
  const summary = bookingBackupAlertTraceSummary(booking);
  const summaryWithAge = nowMs ? bookingBackupAlertTraceSummary(booking, nowMs) : summary;
  return backupAlertTraceDisplayFromSummary({
    batchCount: summary.batchCount,
    bookingStatus: booking.status,
    lastAge: summaryWithAge.lastAge,
    totalNotified: summary.totalNotified,
  });
}

export function bookingBackupAlertTraceSummary(booking: Pick<AdminBooking, 'metadata'>, nowMs = 0) {
  const summary = bookingAlertTraceSummaryFromMetadata(booking.metadata);
  return {
    ...summary,
    lastStage: summary.lastStage ?? null,
    lastCreatedAt: summary.lastCreatedAt ?? null,
    lastAge: summary.lastCreatedAt ? relativeTimeLabel(summary.lastCreatedAt, nowMs) : null,
  };
}

function relativeTimeLabel(value: string, nowMs: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'unknown time';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const minutesAgo = Math.max(0, Math.round((reference - timestamp) / 60_000));
  if (minutesAgo < 1) {
    return 'just now';
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }
  return `${Math.round(hoursAgo / 24)}d ago`;
}
