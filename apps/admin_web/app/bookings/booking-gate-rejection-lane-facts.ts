export type BookingGateRejectionLaneFact = {
  readonly createdAt: string;
  readonly reasonCode: string;
};

export type BookingGateRejectionLaneFacts = {
  readonly customerTooFarCount: number;
  readonly latestAge: string;
  readonly locationEvidenceCount: number;
  readonly partnerTooFarCount: number;
  readonly serviceAreaCount: number;
  readonly totalCount: number;
};

export function bookingGateRejectionLaneFacts(
  logs: readonly BookingGateRejectionLaneFact[],
  options: { readonly relativeTimeLabel: (value: string) => string },
): BookingGateRejectionLaneFacts {
  return {
    customerTooFarCount: countByReason(logs, 'CUSTOMER_CURRENT_LOCATION_TOO_FAR'),
    latestAge: logs[0] ? options.relativeTimeLabel(logs[0].createdAt) : 'none',
    locationEvidenceCount: logs.filter((log) => log.reasonCode.startsWith('CUSTOMER_CURRENT_LOCATION_')).length,
    partnerTooFarCount: countByReason(logs, 'PREFERRED_PARTNER_TOO_FAR'),
    serviceAreaCount: countByReason(logs, 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA'),
    totalCount: logs.length,
  };
}

function countByReason(logs: readonly BookingGateRejectionLaneFact[], reasonCode: string) {
  return logs.filter((log) => log.reasonCode === reasonCode).length;
}
