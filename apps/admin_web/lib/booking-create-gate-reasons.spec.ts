import {
  bookingCreateGateFilterLabel,
  bookingCreateGateReasonFilter,
  bookingCreateGateReasonLabel,
} from './booking-create-gate-reasons';

describe('booking create gate reasons', () => {
  it.each([
    ['BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA', 'service-area', 'Service area'],
    ['CUSTOMER_CURRENT_LOCATION_STALE', 'customer-gps', 'Optional GPS evidence'],
    ['CUSTOMER_CURRENT_LOCATION_TOO_FAR', 'customer-distance', 'Customer distance gate'],
    ['PREFERRED_PARTNER_TOO_FAR', 'first-pick-distance', 'First-pick distance'],
    ['UNKNOWN_REASON', 'unknown', 'Unknown gate'],
  ])('maps %s to a gate filter and label', (reasonCode, filter, label) => {
    expect(bookingCreateGateReasonFilter(reasonCode)).toBe(filter);
    expect(bookingCreateGateFilterLabel(bookingCreateGateReasonFilter(reasonCode))).toBe(label);
  });

  it('keeps customer and Partner detail labels contextual', () => {
    expect(bookingCreateGateReasonLabel('PREFERRED_PARTNER_TOO_FAR', 'customerDetail')).toBe(
      'First-pick Partner is outside the service address radius',
    );
    expect(bookingCreateGateReasonLabel('PREFERRED_PARTNER_TOO_FAR', 'partnerDetail')).toBe(
      'Partner was outside the first-pick distance gate',
    );
  });
});
