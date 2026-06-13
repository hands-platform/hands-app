import type { AdminBooking } from '../../lib/admin-api';
import { bookingAlertEvidenceNeedsOpsFromFacts } from './booking-alert-evidence-needs-ops';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';

export function bookingMonitorAlertEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  const summary = bookingBackupAlertTraceSummary(booking, nowMs);

  return bookingAlertEvidenceNeedsOpsFromFacts({
    alertBatchCount: summary.batchCount,
    participantCount: booking.participants?.length,
    stageKey: () => buildBookingMonitorListStage(booking, nowMs).key,
    status: booking.status,
  });
}
