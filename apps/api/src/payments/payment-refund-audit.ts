type EarningCancellationResult =
  | { skipped?: boolean; reason?: string }
  | {
      skipped?: boolean;
      earning?: { id?: string | null } | null;
      reason?: string;
      receivableAmount?: number | null;
    };

export function paymentRefundEarningCancellationAudit(result: EarningCancellationResult) {
  if (result.skipped || !('earning' in result)) {
    return { skipped: true, reason: result.reason ?? 'UNKNOWN' };
  }

  return {
    skipped: false,
    earningId: result.earning?.id ?? 'unknown',
    ...(result.reason ? { reason: result.reason } : {}),
    ...(typeof result.receivableAmount === 'number' ? { receivableAmount: result.receivableAmount } : {}),
  };
}
