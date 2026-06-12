import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingBackupAlertTraceLabel,
  bookingBackupAlertTracePill,
  bookingBackupAlertTraceTone,
} from './booking-alert-trace';

export type BookingMonitorListBackupAlert = {
  readonly label: string;
  readonly pill: string;
  readonly tone: string;
};

export function bookingMonitorListBackupAlert(
  booking: AdminBooking,
  currentTimeMs: number,
): BookingMonitorListBackupAlert {
  return {
    label: bookingBackupAlertTraceLabel(booking, currentTimeMs),
    pill: bookingBackupAlertTracePill(booking),
    tone: bookingBackupAlertTraceTone(booking),
  };
}
