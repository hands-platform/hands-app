import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorSelectionFromFacts,
  bookingMonitorSelectionLabel,
  bookingMonitorSelectionPathLabel,
} from './booking-monitor-selection';
import { bookingMonitorSelectionFactsFromBooking } from './booking-monitor-selection-inputs';

export function bookingMonitorSelectionCopy(booking: AdminBooking) {
  return bookingMonitorSelectionFromFacts(bookingMonitorSelectionFactsFromBooking(booking));
}

export function bookingMonitorSelectionLabelForBooking(booking: AdminBooking) {
  return bookingMonitorSelectionLabel(bookingMonitorSelectionFactsFromBooking(booking));
}

export function bookingMonitorSelectionPathLabelForBooking(booking: AdminBooking) {
  return bookingMonitorSelectionPathLabel(bookingMonitorSelectionFactsFromBooking(booking));
}
