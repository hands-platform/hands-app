import { EarningStatus, Prisma, ProviderWalletLedgerType } from '@prisma/client';

export const POST_MATCH_CANCELLATION_APPROVED_REASON = 'post_match_cancellation_approved';
export const POST_MATCH_CANCELLATION_HELD_REASON = 'post_match_cancellation_fee_held';
export const POST_MATCH_CANCELLATION_PARTNER_PENDING_REASON = 'partner_cancelled';
export const POST_MATCH_CANCELLATION_REVIEW_MINUTES = 15;

type RestorablePostMatchCancellationEarning = {
  id: string;
  bookingId: string;
  providerProfileId: string;
  netAmount: number;
  currency: string;
  status: EarningStatus;
} | null;

export async function restorePostMatchCancellationEarning(
  tx: Prisma.TransactionClient,
  earning: RestorablePostMatchCancellationEarning,
) {
  if (!earning) {
    return { skipped: true, reason: 'NO_EARNING' };
  }
  if (earning.status === EarningStatus.PAID) {
    return { skipped: true, reason: 'ALREADY_PAID', earningId: earning.id };
  }
  if (earning.status === EarningStatus.CANCELLED || earning.netAmount === 0) {
    return { skipped: true, reason: 'ALREADY_RESTORED', earningId: earning.id };
  }

  const updated = await tx.providerEarning.update({
    where: { bookingId: earning.bookingId },
    data: {
      status: EarningStatus.CANCELLED,
      netAmount: 0,
    },
  });

  await tx.providerWalletLedgerEntry.upsert({
    where: { sourceKey: `earning:${earning.id}:post-match-cancellation-approval` },
    update: {
      amount: -earning.netAmount,
      currency: earning.currency,
      notes: 'Unpaid earning restored by post-match cancellation approval',
      metadata: {
        previousNetAmount: earning.netAmount,
        previousStatus: earning.status,
      },
    },
    create: {
      providerProfileId: earning.providerProfileId,
      bookingId: earning.bookingId,
      earningId: earning.id,
      type: ProviderWalletLedgerType.REFUND_REVERSAL,
      sourceKey: `earning:${earning.id}:post-match-cancellation-approval`,
      amount: -earning.netAmount,
      currency: earning.currency,
      notes: 'Unpaid earning restored by post-match cancellation approval',
      metadata: {
        previousNetAmount: earning.netAmount,
        previousStatus: earning.status,
      },
    },
  });

  return {
    skipped: false,
    earningId: updated.id,
    previousNetAmount: earning.netAmount,
    netAmount: updated.netAmount,
    status: updated.status,
  };
}

export function isPostMatchCancellationAutoApprovalWindow(
  matchedAt: Date | null,
  closedAt: Date | null,
) {
  const minutesAfterMatch = minutesBetween(matchedAt, closedAt);
  return {
    minutesAfterMatch,
    autoApprovalWindow:
      minutesAfterMatch !== null && minutesAfterMatch <= POST_MATCH_CANCELLATION_REVIEW_MINUTES,
  };
}

export function minutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end || end < start) {
    return null;
  }

  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}
