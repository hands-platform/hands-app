import type { AdminBookingSettlementSnapshot } from '../../lib/admin-api';

type PaymentFeeEvidenceInput = Pick<
  AdminBookingSettlementSnapshot,
  'paymentFeePolicyVersionId' | 'paymentFeeRuleSnapshot'
>;

export type PaymentFeeEvidenceState = {
  readonly detail: string;
  readonly label: string;
  readonly reason: string | null;
  readonly tone: 'success' | 'warning';
};

export function paymentFeeEvidenceState(snapshot: PaymentFeeEvidenceInput): PaymentFeeEvidenceState {
  const ruleSnapshot = jsonRecord(snapshot.paymentFeeRuleSnapshot);
  const reason = stringValue(ruleSnapshot?.reason);

  if (!snapshot.paymentFeePolicyVersionId) {
    return {
      detail: reason ?? 'No payment fee policy version is linked to this posted settlement.',
      label: 'Policy missing',
      reason,
      tone: 'warning',
    };
  }

  if (reason) {
    return {
      detail: reason,
      label: 'Rule fallback',
      reason,
      tone: 'warning',
    };
  }

  return {
    detail: `Policy ${snapshot.paymentFeePolicyVersionId} is retained on the settlement.`,
    label: 'Policy linked',
    reason: null,
    tone: 'success',
  };
}

function jsonRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
