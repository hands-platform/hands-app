import { AdminAuditLog, AdminBooking, AdminOperationalPolicySetting, adminGet } from '../../lib/admin-api';
import { BookingMonitor } from './booking-monitor';
import { buildBookingsPageModel } from './booking-page-model';

type BookingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type BookingsPageProps = {
  searchParams?: BookingsPageSearchParams;
};

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const [bookings, auditLogs, policySettings] = await Promise.all([
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const params = await searchParams;
  const model = buildBookingsPageModel({
    auditLogs,
    params,
    policySettings,
  });

  return (
    <BookingMonitor
      bookings={bookings}
      bookingCreateRejections={model.bookingCreateRejections}
      initialView={model.initialView}
      initialEvidenceFilter={model.initialEvidenceFilter}
      initialGateFilter={model.initialGateFilter}
      liveOperationsPolicy={model.liveOperationsPolicy}
    />
  );
}
