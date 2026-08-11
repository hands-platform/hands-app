import type { AdminAuditLog } from '../../../lib/admin-api';
import { DateTimeText } from '../../../components/date-time-text';
import {
  bookingCreateGateFilterLabel,
  bookingCreateGateReasonFilter,
  bookingCreateGateReasonLabel,
} from '../../../lib/booking-create-gate-reasons';
import type { PartnerBookingGateAttemptRow } from './partner-detail-booking-gate-evidence-section';
import {
  dateValue,
  formatDate,
  formatDistance,
  shortRecordId,
} from './partner-detail-format';
import {
  readMetadataObject,
  readNumber,
  readString,
  trimText,
} from './partner-detail-record-helpers';

export function buildPartnerBookingGateAttemptRows(
  auditLogs: AdminAuditLog[],
  providerId: string,
): PartnerBookingGateAttemptRow[] {
  return auditLogs
    .filter((log) => log.action === 'booking.create.rejected')
    .map((log) => {
      const metadata = readMetadataObject(log.metadata);
      const reasonCode = readString(metadata.reasonCode) ?? 'UNKNOWN';
      const gate = bookingCreateGateReasonFilter(reasonCode);
      const bookingAddress = readMetadataObject(metadata.bookingAddress);
      const addressText = readString(bookingAddress.addressText);
      const customerProfileId = readString(metadata.customerProfileId);
      const customerDistance = readNumber(metadata.customerDistanceMeters);
      const customerDistanceLimit = readNumber(metadata.customerDistanceLimitMeters);
      const partnerDistance = readNumber(metadata.preferredProviderDistanceMeters);
      const partnerDistanceLimit = readNumber(metadata.preferredProviderDistanceLimitMeters);
      const currentLocationRecordedAt = readString(metadata.currentLocationRecordedAt);
      const serviceId = readString(metadata.serviceId);
      const distanceParts = [
        partnerDistance !== null
          ? `First-pick ${formatDistance(partnerDistance)} / limit ${formatDistance(
              partnerDistanceLimit ?? 0,
            )}`
          : null,
        customerDistance !== null
          ? `Optional customer GPS ${formatDistance(customerDistance)} / limit ${formatDistance(
              customerDistanceLimit ?? 0,
            )}`
          : null,
      ].filter(Boolean);
      const detailParts = [
        addressText ? `Address: ${addressText}` : 'Address record metadata missing',
        currentLocationRecordedAt
          ? `Optional customer GPS evidence: ${formatDate(currentLocationRecordedAt)}`
          : 'No optional GPS timestamp',
        serviceId ? `Service ${shortRecordId(serviceId)}` : null,
        customerProfileId ? `Customer ${shortRecordId(customerProfileId)}` : null,
      ].filter(Boolean);
      const detailNode = (
        <>
          {addressText ? `Address: ${addressText}` : 'Address record metadata missing'}
          {' / '}
          {currentLocationRecordedAt ? (
            <>
              Optional customer GPS evidence:{' '}
              <DateTimeText fallback="Missing" value={currentLocationRecordedAt} />
            </>
          ) : (
            'No optional GPS timestamp'
          )}
          {serviceId ? <> / Service {shortRecordId(serviceId)}</> : null}
          {customerProfileId ? <> / Customer {shortRecordId(customerProfileId)}</> : null}
        </>
      );

      return {
        id: log.id,
        at: log.createdAt,
        gate,
        gateLabel: bookingCreateGateFilterLabel(gate),
        reasonLabel: bookingCreateGateReasonLabel(reasonCode, 'partnerDetail'),
        detail: detailParts.join(' / '),
        detailNode,
        addressLabel: addressText ? trimText(addressText, 72) : 'No address metadata',
        distanceLabel: distanceParts.length ? distanceParts.join(' / ') : 'No distance value',
        bookingMonitorHref: `/bookings?view=blocked-create&gate=${gate}`,
        auditHref: `/audit-log?query=booking.create.rejected&target=${encodeURIComponent(
          `provider:${providerId}`,
        )}`,
        tone: gate === 'unknown' ? 'pill-warn' : 'pill-info',
      };
    })
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
}
