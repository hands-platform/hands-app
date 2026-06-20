export type PartnerReviewModeContent = {
  title: string;
  badge: string;
  description: string;
  detailFocus: string;
  steps: string[];
};

export type PartnerPrimaryListMode = 'partners' | 'unapproved' | 'unsettled';

const PRIMARY_PARTNER_LIST_REVIEWS = new Set(['', 'unapproved', 'unsettled']);

export function partnerPrimaryListMode(review: string): PartnerPrimaryListMode {
  if (review === 'unapproved' || review === 'unsettled') {
    return review;
  }

  return 'partners';
}

export function shouldRenderPartnerDeepOpsSections(review: string) {
  return !PRIMARY_PARTNER_LIST_REVIEWS.has(review);
}

export function partnerReviewModeContent(review: string): PartnerReviewModeContent | null {
  if (review === 'unapproved') {
    return {
      title: 'Unapproved Partners',
      badge: 'Approval queue',
      description:
        'Partners in this view need admin approval before they become regular Partners or return from a hold.',
      detailFocus:
        'Open the Partner detail page, review all registration, KYC, document, bank, tax, public media, device, and hold facts, then approve or hold with a clear correction reason.',
      steps: [
        'Confirm the Partner profile, legal name, phone, gender, address, and app device facts.',
        'Review KYC, required documents, public media, bank account, tax profile, and agreement status.',
        'Approve only when all required facts pass; otherwise place the Partner on hold with a reason the Partner app can show for correction.',
      ],
    };
  }

  if (review === 'unsettled') {
    return {
      title: 'Unsettled Partners',
      badge: 'Negative wallet',
      description: 'Partners in this view have a negative wallet balance from unpaid HANDS commission.',
      detailFocus:
        'Open the Partner detail page, check cash booking origins, fee debt, wallet ledger, payout impact, and settlement notes before final acceptance, service start, or payout release resumes.',
      steps: [
        'Check the negative wallet amount and the booking or cash collection records that created it.',
        'Confirm whether settlement is pending, partially paid, disputed, or ready to clear.',
        'Keep marketplace visibility and participation open as a warning state while final acceptance, service start, and payout release wait for settlement.',
      ],
    };
  }

  return null;
}
