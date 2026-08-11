export type PartnerReviewModeContent = {
  title: string;
  badge: string;
  description: string;
  detailFocus: string;
  steps: string[];
};

export type PartnerPrimaryListMode = 'partners' | 'approval-pending' | 'unapproved' | 'unsettled';
export type PartnerDecisionQueue = 'approval-pending';

export const PARTNER_APPROVAL_QUEUE_HREF = '/partners?review=approval-pending&sort=oldest';
export const PARTNER_APPROVAL_QUEUE_API_HREF =
  '/admin/partners/list-providers?take=2&review=approval-pending&sort=oldest';

const PRIMARY_PARTNER_LIST_REVIEWS = new Set([
  '',
  'approval-pending',
  'unapproved',
  'unsettled',
  'marketplace-ready',
  'customer-visible-now',
  'customer-visibility-location',
  'customer-visibility-service',
  'customer-visibility-bank',
  'customer-visibility-documents',
]);

export function partnerPrimaryListMode(review: string): PartnerPrimaryListMode {
  if (review === 'approval-pending' || review === 'unapproved' || review === 'unsettled') {
    return review;
  }

  return 'partners';
}

export function readPartnerDecisionQueue(value: string | null | undefined): PartnerDecisionQueue | null {
  return value === 'approval-pending' ? value : null;
}

export function partnerApprovalQueueDetailHref(providerId: string) {
  const params = new URLSearchParams({ decisionQueue: 'approval-pending' });
  return `/partners/${encodeURIComponent(providerId)}?${params.toString()}`;
}

export function withPartnerDecisionQueue(href: string, queue: PartnerDecisionQueue | null) {
  if (!queue) return href;

  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}decisionQueue=${queue}`;
}

export function nextPartnerApprovalHref(
  providers: readonly { readonly id: string }[],
  currentProviderId: string,
) {
  const nextProvider = providers.find((provider) => provider.id !== currentProviderId);
  return nextProvider ? partnerApprovalQueueDetailHref(nextProvider.id) : PARTNER_APPROVAL_QUEUE_HREF;
}

export function partnerDeepOpsAvailable(review: string) {
  return Boolean(review) && !PRIMARY_PARTNER_LIST_REVIEWS.has(review);
}

export function shouldLoadPartnerDeepOps(review: string, details: string) {
  return partnerDeepOpsAvailable(review) && details === 'all';
}

export function partnerReviewModeContent(review: string): PartnerReviewModeContent | null {
  if (review === 'approval-pending') {
    return {
      title: 'Partner approvals',
      badge: 'Awaiting decision',
      description: 'Submitted verification or KYC records waiting for an admin decision.',
      detailFocus:
        'Review the oldest submission first, confirm required identity materials, and approve or return it with a clear correction reason.',
      steps: [
        'Check submission age and review the oldest overdue Partner first.',
        'Confirm verification, KYC, required identity documents, and public profile media.',
        'Approve when complete or return the submission with a correction reason visible to the Partner.',
      ],
    };
  }

  if (review === 'unapproved') {
    return {
      title: 'Onboarding blockers',
      badge: 'Needs follow-up',
      description:
        'Partners blocked by verification, KYC, required evidence, or an account hold. Review the top blocker and decide whether the operator or Partner must act next.',
      detailFocus:
        'Open the Partner detail page, confirm the current blocker, and request one clear correction or complete the available admin review.',
      steps: [
        'Identify the current onboarding stage and the highest-priority blocker.',
        'Confirm whether the next action belongs to the operator or the Partner.',
        'Complete the review or request one correction the Partner can act on.',
      ],
    };
  }

  if (review === 'unsettled') {
    return {
      title: 'Wallet debt',
      badge: 'Negative VND balance',
      description:
        'Partners whose canonical VND wallet balance is negative. Review the debt and current withdrawal state before settlement restrictions are cleared.',
      detailFocus:
        'Open the Partner detail page to review the wallet ledger and settlement evidence before final acceptance, service start, or payout release resumes.',
      steps: [
        'Confirm the canonical VND wallet balance is still negative.',
        'Review ledger evidence and any open withdrawal separately.',
        'Keep marketplace visibility and participation open as a warning state while final acceptance, service start, and payout release wait for settlement.',
      ],
    };
  }

  if (review === 'customer-visibility-bank') {
    return {
      title: 'Customer visibility: bank',
      badge: 'Customer App blocker',
      description:
        'Approved Partners marked available now or soon who are hidden from the Customer App because an approved payout bank account is missing.',
      detailFocus:
        'Open the Partner detail page, verify the submitted payout account, and approve or return it with a correction reason.',
      steps: [
        'Review the oldest blocked Partner first.',
        'Confirm the payout account belongs to the Partner and the submitted details are complete.',
        'Approve the account or return it with a correction reason visible to the Partner.',
      ],
    };
  }

  if (review === 'customer-visible-now') {
    return {
      title: 'Customer App visible now',
      badge: 'Public supply',
      description:
        'Partners currently returned by Customer App discovery after public profile, bank, document, active service, and fresh location checks.',
      detailFocus:
        'Open a Partner only when public profile quality or availability needs an operational check.',
      steps: [
        'Confirm the Partner is intentionally available now or soon.',
        'Check that the customer-facing service and public media remain usable.',
        'Use the blocker queues when a Partner should be visible but is missing.',
      ],
    };
  }

  if (review === 'customer-visibility-location') {
    return {
      title: 'Customer visibility: location',
      badge: 'Customer App blocker',
      description:
        'Approved Partners marked available now or soon who are hidden from the Customer App because saved coordinates are missing or older than the matching freshness policy.',
      detailFocus:
        'Open the Partner detail page and verify the latest app session and location heartbeat before contacting the Partner.',
      steps: [
        'Review Partners with missing coordinates before stale-only records.',
        'Confirm the Partner app can report location while work availability is enabled.',
        'Ask the Partner to reopen the app and refresh location when the heartbeat is stale.',
      ],
    };
  }

  if (review === 'customer-visibility-service') {
    return {
      title: 'Customer visibility: service',
      badge: 'Customer App blocker',
      description:
        'Approved Partners marked available now or soon who are hidden from the Customer App because no active Partner service backed by an active catalog service exists.',
      detailFocus:
        'Open the Partner detail page and restore only a valid, customer-facing service assignment.',
      steps: [
        'Confirm whether the Partner service was disabled intentionally.',
        'Check that the linked service is still active in the service catalog.',
        'Restore or replace the service assignment only after profile and pricing review.',
      ],
    };
  }

  if (review === 'customer-visibility-documents') {
    return {
      title: 'Customer visibility: documents',
      badge: 'Customer App blocker',
      description:
        'Approved Partners marked available now or soon who are hidden from the Customer App because required identity documents are incomplete.',
      detailFocus:
        'Open the Partner detail page and confirm that the front ID, back ID, and selfie are all approved.',
      steps: [
        'Review the oldest blocked Partner first.',
        'Check the front ID, back ID, and selfie together against the Partner profile.',
        'Approve the complete identity set or return it with one clear correction reason.',
      ],
    };
  }

  return null;
}
