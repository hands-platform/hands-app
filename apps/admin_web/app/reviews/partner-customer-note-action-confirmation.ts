import type { AdminPartnerCustomerReview } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';
import { partnerCustomerReviewStatusLabel } from './review-page-model';

export type PartnerNoteModerationStatus = 'HIDDEN' | 'PUBLISHED' | 'REPORTED';

export function partnerNoteModerationConfirmHref(
  noteId: string,
  status: PartnerNoteModerationStatus,
  returnTo: string,
) {
  const safeReturnTo = safePartnerNoteReturnTo(returnTo);
  const url = new URL(safeReturnTo, 'http://admin.local');
  url.searchParams.set('confirm', 'moderate');
  url.searchParams.set('noteId', noteId);
  url.searchParams.set('returnTo', safeReturnTo);
  url.searchParams.set('targetStatus', status);
  return `${url.pathname}${url.search}`;
}

export function readPartnerNoteModerationStatus(value: string): PartnerNoteModerationStatus | null {
  return value === 'HIDDEN' || value === 'PUBLISHED' || value === 'REPORTED' ? value : null;
}

export function buildPartnerNoteModerationConfirmation(
  note: AdminPartnerCustomerReview | null,
  status: PartnerNoteModerationStatus | null,
  returnTo: string,
) {
  if (!note || !status) return null;

  const safeReturnTo = safePartnerNoteReturnTo(returnTo);
  const targetLabel = partnerCustomerReviewStatusLabel(status);
  const metadata = partnerNoteModerationMetadata[status];

  return {
    cancelHref: `${safeReturnTo}#partner-note-${note.id}`,
    confirmLabel: metadata.confirmLabel,
    hiddenInputs: [
      { name: 'noteId', value: note.id },
      { name: 'status', value: status },
      { name: 'returnTo', value: safeReturnTo },
      ...(status === 'PUBLISHED' ? [{ name: 'reason', value: 'Returned to Retained' }] : []),
    ],
    impact: metadata.impact,
    note,
    reasonOptions: status === 'PUBLISHED' ? null : partnerNoteModerationReasonOptions[status],
    targetLabel,
    title: partnerNoteModerationTitle(status, shortId(note.id)),
    tone: metadata.tone,
  };
}

export function safePartnerNoteReturnTo(value: string) {
  if (!value || /[\r\n\\]/.test(value)) return '/reviews/partner-customer-evaluations';
  try {
    const url = new URL(value, 'http://admin.local');
    return url.origin === 'http://admin.local' && url.pathname === '/reviews/partner-customer-evaluations'
      ? `${url.pathname}${url.search}`
      : '/reviews/partner-customer-evaluations';
  } catch {
    return '/reviews/partner-customer-evaluations';
  }
}

const partnerNoteModerationMetadata: Record<
  PartnerNoteModerationStatus,
  { readonly confirmLabel: string; readonly impact: string; readonly tone: StatusBadgeTone }
> = {
  PUBLISHED: {
    confirmLabel: 'Return to Retained',
    impact:
      'The note remains internal. Its active reason is cleared, while the moderation history is preserved.',
    tone: 'success',
  },
  REPORTED: {
    confirmLabel: 'Send to Needs review',
    impact:
      "The note remains internal and increases this customer's Needs review signal used by Customer Support.",
    tone: 'info',
  },
  HIDDEN: {
    confirmLabel: 'Restrict note',
    impact:
      "The note remains internal evidence, is removed from the customer's active Needs review signal, and must not be used for customer decisions.",
    tone: 'warning',
  },
};

function partnerNoteModerationTitle(status: PartnerNoteModerationStatus, noteId: string) {
  if (status === 'REPORTED') return `Send note ${noteId} to Needs review?`;
  if (status === 'HIDDEN') return `Restrict note ${noteId}?`;
  return `Return note ${noteId} to Retained?`;
}

const partnerNoteModerationReasonOptions = {
  REPORTED: [
    { label: 'Select a reason', value: '' },
    { label: 'Booking context requires verification', value: 'Booking context requires verification' },
    { label: 'Factual dispute', value: 'Factual dispute' },
    { label: 'Possible sensitive data', value: 'Possible sensitive data' },
    { label: 'Possible abusive language', value: 'Possible abusive language' },
  ],
  HIDDEN: [
    { label: 'Select a reason', value: '' },
    { label: 'Confirmed sensitive data', value: 'Confirmed sensitive data' },
    {
      label: 'Confirmed abusive or discriminatory language',
      value: 'Confirmed abusive or discriminatory language',
    },
    { label: 'Confirmed inaccurate note', value: 'Confirmed inaccurate note' },
    { label: 'Policy restriction', value: 'Policy restriction' },
  ],
} as const;
