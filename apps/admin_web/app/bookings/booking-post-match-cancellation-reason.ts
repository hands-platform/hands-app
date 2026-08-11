import type { AdminBooking } from '../../lib/admin-api';
import { readPlainRecord } from '../../lib/admin-format';
import type { BookingPostMatchCancellationPillTone } from './booking-post-match-cancellation-display';

export const POST_MATCH_CANCELLATION_REASON_CODES = [
  'CUSTOMER_REQUESTED',
  'CUSTOMER_NOT_FOUND',
  'SAFETY_CONCERN',
  'SERVICE_CANNOT_BE_PROVIDED',
  'OTHER',
] as const;

export type BookingPostMatchCancellationReasonCode =
  (typeof POST_MATCH_CANCELLATION_REASON_CODES)[number];

export type BookingPostMatchCancellationReasonFilter =
  | 'all'
  | 'LEGACY'
  | BookingPostMatchCancellationReasonCode;

type BookingPostMatchCancellationReasonDisplay = {
  readonly label: string;
  readonly title: string;
  readonly tone: BookingPostMatchCancellationPillTone;
};

const POST_MATCH_CANCELLATION_REASON_CODE_SET =
  new Set<string>(POST_MATCH_CANCELLATION_REASON_CODES);
const POST_MATCH_CANCELLATION_REASON_FILTER_SET =
  new Set<string>([...POST_MATCH_CANCELLATION_REASON_CODES, 'LEGACY']);

const POST_MATCH_CANCELLATION_REASON_DISPLAYS: Record<
  BookingPostMatchCancellationReasonCode,
  BookingPostMatchCancellationReasonDisplay
> = {
  CUSTOMER_REQUESTED: {
    label: 'Customer requested',
    title: 'The Partner recorded that the customer requested this cancellation.',
    tone: 'pill-info',
  },
  CUSTOMER_NOT_FOUND: {
    label: 'Could not meet customer',
    title: 'The Partner could not meet the customer. Admin evidence review is required.',
    tone: 'pill-warn',
  },
  SAFETY_CONCERN: {
    label: 'Safety concern',
    title: 'The Partner reported a safety concern. Review retained chat and location evidence.',
    tone: 'pill-danger',
  },
  SERVICE_CANNOT_BE_PROVIDED: {
    label: 'Unable to provide service',
    title: 'The Partner could not provide the booked service. Admin review is required.',
    tone: 'pill-warn',
  },
  OTHER: {
    label: 'Other reason',
    title: 'The Partner selected Other and supplied a detailed cancellation note.',
    tone: 'pill-neutral',
  },
};

export const postMatchCancellationReasonFilterOptions = [
  { label: 'All cancellation reasons', value: 'all' },
  { label: 'Customer requested', value: 'CUSTOMER_REQUESTED' },
  { label: 'Could not meet customer', value: 'CUSTOMER_NOT_FOUND' },
  { label: 'Safety concern', value: 'SAFETY_CONCERN' },
  { label: 'Unable to provide service', value: 'SERVICE_CANNOT_BE_PROVIDED' },
  { label: 'Other reason', value: 'OTHER' },
  { label: 'Legacy / unknown reason', value: 'LEGACY' },
] as const satisfies readonly {
  readonly label: string;
  readonly value: BookingPostMatchCancellationReasonFilter;
}[];

export function readPostMatchCancellationReasonFilter(
  value: string | string[] | undefined,
): BookingPostMatchCancellationReasonFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim().toUpperCase();
  return normalized && POST_MATCH_CANCELLATION_REASON_FILTER_SET.has(normalized)
    ? (normalized as BookingPostMatchCancellationReasonFilter)
    : 'all';
}

export function postMatchCancellationReasonCode(
  booking: Pick<AdminBooking, 'metadata'>,
): BookingPostMatchCancellationReasonCode | null {
  const metadata = readPlainRecord(booking.metadata);
  const cancellation = readPlainRecord(metadata?.postMatchCancellation);
  const reasonCode =
    typeof cancellation?.reasonCode === 'string'
      ? cancellation.reasonCode.trim().toUpperCase()
      : '';
  return POST_MATCH_CANCELLATION_REASON_CODE_SET.has(reasonCode)
    ? (reasonCode as BookingPostMatchCancellationReasonCode)
    : null;
}

export function postMatchCancellationRequiresAdminReview(
  booking: Pick<AdminBooking, 'metadata'>,
) {
  const metadata = readPlainRecord(booking.metadata);
  const cancellation = readPlainRecord(metadata?.postMatchCancellation);
  return cancellation?.requiresAdminReview === true;
}

export function postMatchCancellationDetail(
  booking: Pick<AdminBooking, 'closedNote' | 'metadata'>,
) {
  const metadata = readPlainRecord(booking.metadata);
  const cancellation = readPlainRecord(metadata?.postMatchCancellation);
  const detail =
    typeof cancellation?.detail === 'string'
      ? cancellation.detail.trim()
      : '';
  if (detail) {
    return detail;
  }

  const closedNote = booking.closedNote?.trim() ?? '';
  const noteWithoutReason = closedNote.replace(/^[^:]{1,80}:\s*/, '').trim();
  return noteWithoutReason || closedNote || null;
}

export function postMatchCancellationReasonDisplay(
  booking: Pick<AdminBooking, 'metadata' | 'status'>,
): BookingPostMatchCancellationReasonDisplay | null {
  if (booking.status !== 'CANCELLED') {
    return null;
  }

  const reasonCode = postMatchCancellationReasonCode(booking);
  return reasonCode
    ? POST_MATCH_CANCELLATION_REASON_DISPLAYS[reasonCode]
    : {
        label: 'Legacy reason',
        title: 'This cancellation predates structured Partner cancellation reasons.',
        tone: 'pill-neutral',
      };
}

export function postMatchCancellationReasonFilterLabel(
  value: BookingPostMatchCancellationReasonFilter,
) {
  return (
    postMatchCancellationReasonFilterOptions.find((option) => option.value === value)?.label ??
    'All cancellation reasons'
  );
}
