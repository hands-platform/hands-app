import { bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingServiceOptionLabel,
  coordinateLabel,
  formatDate,
  providerName,
} from './booking-formatters';
import { bookingDetailProviderLocationMetricHelper } from './booking-provider-location-metric';
import { bookingRecordServiceRows as buildBookingRecordServiceRows } from './booking-record-info-rows';

export function bookingDetailCustomerRows({
  booking,
  addressLine,
  addressPin,
}: {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
}) {
  return [
    { label: 'Name', value: booking.customerProfile?.user?.fullName ?? 'Customer' },
    { label: 'Phone', value: booking.customerProfile?.user?.phone ?? 'No phone' },
    { label: 'Address', value: addressLine },
    { label: 'Pin', value: addressPin },
    { label: 'Request opened', value: formatDate(bookingRequestOpenedAt(booking)) },
    { label: 'Expires', value: formatDate(booking.expiresAt) },
  ];
}

export function bookingDetailServiceRows(booking: AdminBookingDetail) {
  const service = booking.services?.[0];

  return buildBookingRecordServiceRows({
    optionLabel: bookingServiceOptionLabel(booking),
    serviceName: service?.service?.name ?? 'Service pending',
    durationLabel: `${service?.service?.durationMin ?? '-'} min`,
    notesLabel: booking.notes ?? 'No notes',
    createdLabel: formatDate(booking.createdAt),
    updatedLabel: formatDate(booking.updatedAt),
  });
}

export function bookingDetailHandoffRows({
  booking,
  finalPartnerSummary,
  latestLocation,
}: {
  booking: AdminBookingDetail;
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  latestLocation?: AdminLocationSnapshot | null;
}) {
  return [
    { label: 'Preferred', value: providerName(booking.preferredProvider) },
    { label: 'Final', value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Not selected' },
    { label: 'Final phone', value: booking.selectedProvider?.user?.phone ?? 'No phone' },
    {
      label: 'Latest Partner pin',
      value: latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : 'No live pin yet',
    },
    {
      label: 'Latest pin time',
      value: latestLocation ? formatDate(latestLocation.recordedAt) : 'No location shared',
    },
    { label: 'Location freshness', value: bookingDetailProviderLocationMetricHelper(booking) },
  ];
}

export function bookingDetailLocationTrailRows(locationTrailSnapshots: readonly AdminLocationSnapshot[]) {
  return locationTrailSnapshots.map((snapshot) => ({
    id: snapshot.id,
    coordinate: coordinateLabel(snapshot.lat, snapshot.lng),
    recordedAt: formatDate(snapshot.recordedAt),
  }));
}
