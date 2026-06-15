import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import {
  bookingOpsBadges,
  type BookingOpsLocationFreshness,
} from '../../../lib/booking-ops-badges';
import { primaryBookingOpsInstruction } from '../../../lib/booking-primary-ops-instruction';

export type BookingDetailOpsCommandCenterInput = {
  booking: AdminBookingDetail;
  attentionFlags: AttentionFlag[];
  cashFeeDebtNeedsSettlement: boolean;
  locationFreshness: BookingOpsLocationFreshness;
};

export function bookingDetailOpsCommandCenter({
  booking,
  attentionFlags,
  cashFeeDebtNeedsSettlement,
  locationFreshness,
}: BookingDetailOpsCommandCenterInput) {
  return {
    instruction: primaryBookingOpsInstruction(booking, {
      cashDebtNeedsSettlement: cashFeeDebtNeedsSettlement,
    }),
    badges: bookingOpsBadges(booking, {
      attentionFlags,
      cashDebtNeedsSettlement: cashFeeDebtNeedsSettlement,
      locationFreshness,
    }),
    cashDebtNeedsSettlement: cashFeeDebtNeedsSettlement,
  };
}
