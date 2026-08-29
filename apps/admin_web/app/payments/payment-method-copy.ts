const EXTERNAL_PAYMENT_METHODS = new Set(['MOMO', 'VNPAY', 'CARD', 'BANK_TRANSFER']);

export function paymentProviderReferenceCopy(
  method: string | null | undefined,
  providerRef: string | null | undefined,
) {
  if (providerRef) return providerRef;
  if (method === 'CUSTOMER_WALLET') return 'Internal wallet ledger';
  if (method === 'CASH') return 'Not applicable to cash payment';
  if (method === 'MANUAL') return 'Not applicable to manual payment';
  if (method && EXTERNAL_PAYMENT_METHODS.has(method)) return 'No gateway reference';
  return method ? `Not applicable to ${method.replaceAll('_', ' ').toLowerCase()}` : 'Not applicable';
}
