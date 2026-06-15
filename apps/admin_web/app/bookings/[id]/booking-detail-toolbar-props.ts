import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { BookingDetailToolbarProps } from './booking-command-briefing-sections';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingServiceOptionLabel } from './booking-formatters';

export type BookingDetailToolbarPropsInput = {
  booking: AdminBookingDetail;
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
};

export function bookingDetailToolbarProps({
  booking,
  finalPartnerSummary,
}: BookingDetailToolbarPropsInput): BookingDetailToolbarProps {
  return {
    bookingId: booking.id,
    chatRoomId: booking.chatRoom?.id,
    customerProfileId: booking.customerProfile?.id,
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    paymentId: booking.payment?.id,
    refundId: booking.refunds?.[0]?.id,
    serviceLabel: bookingServiceOptionLabel(booking),
    status: booking.status,
  };
}
