import { AdminAuditLog, AdminBooking, AdminOperationalPolicySetting, adminGet } from '../../lib/admin-api';
import { buildAdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { BookingMonitor } from './booking-monitor';
import {
  readBookingEvidenceFilter,
  readBookingGateFilter,
  readBookingView,
} from './booking-page-params';

type BookingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({ searchParams }: { searchParams?: BookingsPageSearchParams }) {
  const [bookings, auditLogs, policySettings] = await Promise.all([
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
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
      liveOperationsPolicy={buildAdminLiveOperationsPolicy(policySettings)}
    />
  );
}

