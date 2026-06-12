export type BookingNextActionOwner = 'Dispatch' | 'Finance' | 'Support' | 'Safety';

export type BookingNextActionOwnerInput = {
  readonly completedCloseoutNeedsOps: () => boolean;
  readonly flagTitle?: string | null;
  readonly paymentNeedsOps: () => boolean;
  readonly status?: string | null;
};

const financeActionFlagKeywords = ['payment', 'closeout', 'cash', 'payout'] as const;

export function bookingNextActionOwnerFromFacts(
  input: BookingNextActionOwnerInput,
): BookingNextActionOwner {
  const flagTitle = input.flagTitle?.toLowerCase() ?? '';

  if (
    flagTitleHasAny(flagTitle, financeActionFlagKeywords) ||
    input.paymentNeedsOps() ||
    input.completedCloseoutNeedsOps()
  ) {
    return 'Finance';
  }
  if (input.status === 'NO_SHOW' || flagTitle.includes('no-show')) {
    return 'Safety';
  }
  if (input.status === 'CANCELLED' || input.status === 'EXPIRED' || flagTitle.includes('chat')) {
    return 'Support';
  }
  return 'Dispatch';
}

function flagTitleHasAny(flagTitle: string, keywords: readonly string[]) {
  return keywords.some((keyword) => flagTitle.includes(keyword));
}
