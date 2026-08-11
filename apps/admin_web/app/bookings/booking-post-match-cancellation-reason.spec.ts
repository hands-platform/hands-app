import type { AdminBooking } from '../../lib/admin-api';
import {
  postMatchCancellationDetail,
  postMatchCancellationReasonCode,
  postMatchCancellationReasonDisplay,
  readPostMatchCancellationReasonFilter,
} from './booking-post-match-cancellation-reason';

describe('post-match cancellation reason', () => {
  it('reads only supported reason filters', () => {
    expect(readPostMatchCancellationReasonFilter('customer_not_found')).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    expect(readPostMatchCancellationReasonFilter('unknown')).toBe('all');
    expect(readPostMatchCancellationReasonFilter(undefined)).toBe('all');
  });

  it('maps persisted metadata to a clear operating badge', () => {
    const booking = {
      metadata: {
        postMatchCancellation: {
          reasonCode: 'SAFETY_CONCERN',
          reasonLabel: 'Safety concern',
          requiresAdminReview: true,
        },
      },
      status: 'CANCELLED',
    } as AdminBooking;

    expect(postMatchCancellationReasonCode(booking)).toBe('SAFETY_CONCERN');
    expect(postMatchCancellationReasonDisplay(booking)).toEqual({
      label: 'Safety concern',
      title: 'The Partner reported a safety concern. Review retained chat and location evidence.',
      tone: 'pill-danger',
    });
  });

  it('labels older cancellations without structured metadata', () => {
    expect(
      postMatchCancellationReasonDisplay({
        metadata: null,
        status: 'CANCELLED',
      } as AdminBooking),
    ).toMatchObject({
      label: 'Legacy reason',
      tone: 'pill-neutral',
    });
  });

  it('keeps the Partner detail separate from the structured reason label', () => {
    expect(
      postMatchCancellationDetail({
        closedNote: 'Could not meet customer: legacy fallback',
        metadata: {
          postMatchCancellation: {
            detail: 'Arrived at the saved address and called twice.',
          },
        },
      }),
    ).toBe('Arrived at the saved address and called twice.');

    expect(
      postMatchCancellationDetail({
        closedNote: 'Could not meet customer: legacy fallback',
        metadata: null,
      }),
    ).toBe('legacy fallback');
  });
});
