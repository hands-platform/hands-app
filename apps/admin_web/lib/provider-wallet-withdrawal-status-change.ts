export type ProviderWalletWithdrawalStatusChangeView = {
  previousStatus: string;
  nextStatus: string;
  transitionLabel: string;
  lockedAmountReleased: boolean;
  lockedAmountRetained: boolean;
  evidenceAmount: number | null;
};

export function providerWalletWithdrawalStatusChangeView(
  metadata: unknown,
): ProviderWalletWithdrawalStatusChangeView | null {
  const root = recordFromUnknown(metadata);
  const statusChange = recordFromUnknown(root?.lastStatusChange);
  const previousStatus = stringFromUnknown(statusChange?.previousStatus);
  const nextStatus = stringFromUnknown(statusChange?.nextStatus);

  if (!previousStatus || !nextStatus) {
    return null;
  }

  const lockedAmountReleased = statusChange?.lockedAmountReleased === true;
  const lockedAmountRetained = statusChange?.lockedAmountRetained === true;
  const releasedAmount = numberFromUnknown(statusChange?.releasedAmount);
  const amount = numberFromUnknown(statusChange?.amount);

  return {
    previousStatus,
    nextStatus,
    transitionLabel: `${providerWalletWithdrawalStatusLabel(previousStatus)} -> ${providerWalletWithdrawalStatusLabel(nextStatus)}`,
    lockedAmountReleased,
    lockedAmountRetained,
    evidenceAmount: lockedAmountReleased ? releasedAmount ?? amount : amount ?? releasedAmount,
  };
}

function providerWalletWithdrawalStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFromUnknown(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberFromUnknown(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
