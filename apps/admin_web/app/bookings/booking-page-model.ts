import type { AdminAuditLog, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { buildAdminLiveOperationsPolicy } from '../../lib/operations-policy';
import {
  readBookingDateInput,
  readBookingDateRangeFilter,
  readBookingEvidenceFilter,
  readBookingGateFilter,
  readBookingView,
} from './booking-page-params';
import type { BookingDateRangeFilter } from './booking-date-range-filter';

type BookingPageParams = Record<string, string | string[] | undefined> | undefined;

type BuildBookingsPageModelInput = {
  readonly auditLogs: readonly AdminAuditLog[];
  readonly dateRangeFallback?: BookingDateRangeFilter;
  readonly params: BookingPageParams;
  readonly policySettings: readonly AdminOperationalPolicySetting[];
};

export function buildBookingsPageModel({
  auditLogs,
  dateRangeFallback,
  params,
  policySettings,
}: BuildBookingsPageModelInput) {
  return {
    bookingCreateRejections: auditLogs.filter((log) => log.action === 'booking.create.rejected'),
    initialCustomDateFrom: readBookingDateInput(params?.dateFrom),
    initialCustomDateTo: readBookingDateInput(params?.dateTo),
    initialDateRangeFilter: readBookingDateRangeFilter(params?.dateRange, dateRangeFallback),
    initialEvidenceFilter: readBookingEvidenceFilter(params?.evidence),
    initialGateFilter: readBookingGateFilter(params?.gate),
    initialView: readBookingView(params?.view, params?.status),
    liveOperationsPolicy: buildAdminLiveOperationsPolicy([...policySettings]),
  };
}
