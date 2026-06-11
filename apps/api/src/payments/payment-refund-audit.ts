type EarningCancellationResult =
  | { skipped?: boolean; reason?: string }
  | { skipped?: boolean; earning?: { id?: string | null } | null; reason?: string };

export function paymentRefundEarningCancellationAudit(result: EarningCancellationResult) {
  if (result.skipped || !('earning' in result)) {
    return { skipped: true, reason: result.reason ?? 'UNKNOWN' };
  }

  return { skipped: false, earningId: result.earning?.id ?? 'unknown' };
}
