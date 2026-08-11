export const providerCancellationReasonCodes = [
  'CUSTOMER_REQUESTED',
  'CUSTOMER_NOT_FOUND',
  'SAFETY_CONCERN',
  'SERVICE_CANNOT_BE_PROVIDED',
  'OTHER',
] as const;

export type ProviderCancellationReasonCode =
  (typeof providerCancellationReasonCodes)[number];

const providerCancellationReasonLabels: Record<ProviderCancellationReasonCode, string> = {
  CUSTOMER_REQUESTED: 'Customer requested cancellation',
  CUSTOMER_NOT_FOUND: 'Could not meet customer',
  SAFETY_CONCERN: 'Safety concern',
  SERVICE_CANNOT_BE_PROVIDED: 'Unable to provide service',
  OTHER: 'Other reason',
};

export function providerCancellationReasonLabel(reasonCode: ProviderCancellationReasonCode) {
  return providerCancellationReasonLabels[reasonCode];
}

export function providerCancellationRequiresAdminReview(
  reasonCode: ProviderCancellationReasonCode,
) {
  return reasonCode !== 'CUSTOMER_REQUESTED';
}
