import type { AdminBooking } from '../../lib/admin-api';
import type { BookingPricingPolicySignalInput } from '../../lib/booking-pricing-policy-signal';

type BookingPricingPolicyBooking = Pick<AdminBooking, 'payment' | 'services'>;

export function bookingPricingPolicySignalInput(
  booking: BookingPricingPolicyBooking,
): BookingPricingPolicySignalInput {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;

  return {
    hasBookedService: Boolean(bookedService),
    hasService: Boolean(service),
    customerPrice: bookedService?.price ?? booking.payment?.amount,
    minimumPrice: service?.basePrice,
    priceStep: service?.priceStep,
    payoutRules: service?.payoutRules ?? [],
  };
}
