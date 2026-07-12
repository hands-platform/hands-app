import type { AdminEarning } from '../../lib/admin-api';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';

export function buildFinanceRows(earnings: readonly AdminEarning[]) {
  return earnings
    .filter((earning) => earning.netAmount < 0 || earning.status !== 'PAID')
    .slice(0, 40)
    .map((earning) => ({
      id: earning.id,
      providerId: earning.providerProfileId,
      bookingId: earning.bookingId,
      partnerName: operatorDisplayText(
        earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Partner',
      ),
      grossAmount: earning.grossAmount,
      platformFee: earning.platformFee,
      withholdingAmount: earning.withholdingAmount,
      netAmount: earning.netAmount,
      currency: earning.currency,
      status: earning.status,
      createdAt: earning.createdAt,
      statusClass: financeRowStatusClass(earning),
      reviewReason: financeRowReviewReason(earning),
    }));
}

export type FinanceHandoffRow = ReturnType<typeof buildFinanceRows>[number];

function financeRowStatusClass(earning: AdminEarning) {
  if (earning.netAmount < 0) {
    return 'pill pill-danger';
  }
  if (earning.status === 'AVAILABLE') {
    return 'pill pill-info';
  }
  return 'pill pill-warn';
}

function financeRowReviewReason(earning: AdminEarning) {
  if (earning.netAmount < 0) {
    return 'Negative wallet effect creates or increases Partner receivable.';
  }
  if (earning.status === 'AVAILABLE') {
    return 'Available earning still needs payout release review.';
  }
  return 'Earning is not fully paid yet.';
}
