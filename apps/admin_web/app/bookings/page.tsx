import { AdminAuditLog, AdminBooking, adminGet } from '../../lib/admin-api';
import { BookingMonitor, type BookingEvidenceFilter, type BookingGateFilter } from './booking-monitor';

type BookingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({ searchParams }: { searchParams?: BookingsPageSearchParams }) {
  const [bookings, auditLogs] = await Promise.all([
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
  ]);
  const bookingCreateRejections = auditLogs.filter((log) => log.action === 'booking.create.rejected');
  const params = await searchParams;
  const initialView = readBookingView(params?.view, params?.status);
  const initialEvidenceFilter = readBookingEvidenceFilter(params?.evidence);
  const initialGateFilter = readBookingGateFilter(params?.gate);

  return (
    <BookingMonitor
      bookings={bookings}
      bookingCreateRejections={bookingCreateRejections}
      initialView={initialView}
      initialEvidenceFilter={initialEvidenceFilter}
      initialGateFilter={initialGateFilter}
    />
  );
}

function readBookingView(value: string | string[] | undefined, statusValue?: string | string[] | undefined) {
  const view = Array.isArray(value) ? value[0] : value;
  const status = Array.isArray(statusValue) ? statusValue[0] : statusValue;
  if (
    view === 'attention' ||
    view === 'matching' ||
    view === 'first-pick' ||
    view === 'backup' ||
    view === 'marketplace' ||
    view === 'customer-choice' ||
    view === 'handoff-repair' ||
    view === 'no-supply' ||
    view === 'blocked-create' ||
    view === 'address' ||
    view === 'payment' ||
    view === 'cash-debt' ||
    view === 'closeout' ||
    view === 'pricing' ||
    view === 'location' ||
    view === 'chat' ||
    view === 'chat-repair' ||
    view === 'expired' ||
    view === 'no-show' ||
    view === 'all'
  ) {
    return view === 'backup' ? 'marketplace' : view;
  }
  if (status === 'EXPIRED') {
    return 'expired';
  }
  if (status === 'NO_SHOW') {
    return 'no-show';
  }
  return 'active';
}

function readBookingEvidenceFilter(value: string | string[] | undefined): BookingEvidenceFilter {
  const evidence = Array.isArray(value) ? value[0] : value;
  if (
    evidence === 'address' ||
    evidence === 'partner' ||
    evidence === 'chat' ||
    evidence === 'money' ||
    evidence === 'location' ||
    evidence === 'alerts' ||
    evidence === 'closeout'
  ) {
    return evidence;
  }
  return 'all';
}

function readBookingGateFilter(value: string | string[] | undefined): BookingGateFilter {
  const gate = Array.isArray(value) ? value[0] : value;
  if (
    gate === 'service-area' ||
    gate === 'customer-gps' ||
    gate === 'customer-distance' ||
    gate === 'first-pick-distance' ||
    gate === 'unknown'
  ) {
    return gate;
  }
  return 'all';
}
