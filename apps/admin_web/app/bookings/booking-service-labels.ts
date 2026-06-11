import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatMoney } from '../../lib/admin-format';
import { bookingServiceListLabelsFromFacts } from '../../lib/booking-service-list-labels';

export function bookingServiceOptionLabel(booking: AdminBooking) {
  return bookingServiceListLabels(booking).optionLabel;
}

export function bookingServicePriceLabel(booking: AdminBooking) {
  return bookingServiceListLabels(booking).priceLabel;
}

export function bookingServicePayoutRuleLabel(booking: AdminBooking) {
  return bookingServiceListLabels(booking).payoutRuleLabel;
}

function bookingServiceListLabels(booking: AdminBooking) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  return bookingServiceListLabelsFromFacts({
    currency,
    customerPrice,
    durationMin: service?.durationMin,
    formatMoney,
    minimumPrice: service?.basePrice,
    payoutRules: service?.payoutRules ?? [],
    serviceName: service?.name ? marketplaceDisplayText(service.name) : null,
  });
}
