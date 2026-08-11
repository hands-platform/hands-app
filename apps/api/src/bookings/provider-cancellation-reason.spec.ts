import { describe, expect, it } from 'vitest';
import {
  providerCancellationReasonCodes,
  providerCancellationReasonLabel,
  providerCancellationRequiresAdminReview,
} from './provider-cancellation-reason';

describe('provider cancellation reasons', () => {
  it('keeps the supported Partner choices stable', () => {
    expect(providerCancellationReasonCodes).toEqual([
      'CUSTOMER_REQUESTED',
      'CUSTOMER_NOT_FOUND',
      'SAFETY_CONCERN',
      'SERVICE_CANNOT_BE_PROVIDED',
      'OTHER',
    ]);
  });

  it('only permits customer-requested cancellations to use automatic approval', () => {
    expect(providerCancellationRequiresAdminReview('CUSTOMER_REQUESTED')).toBe(false);
    expect(providerCancellationRequiresAdminReview('CUSTOMER_NOT_FOUND')).toBe(true);
    expect(providerCancellationRequiresAdminReview('SAFETY_CONCERN')).toBe(true);
    expect(providerCancellationRequiresAdminReview('SERVICE_CANNOT_BE_PROVIDED')).toBe(true);
    expect(providerCancellationRequiresAdminReview('OTHER')).toBe(true);
  });

  it('provides an operator-readable label for retained cancellation evidence', () => {
    expect(providerCancellationReasonLabel('CUSTOMER_NOT_FOUND')).toBe(
      'Could not meet customer',
    );
  });
});
