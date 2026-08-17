export const TAX_POLICY_ACTIVATION_QUEUE_NAME = 'tax-policy-activation';
export const TAX_POLICY_ACTIVATION_JOB_NAME = 'activate-tax-policy';
export const TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME = 'activate-due-tax-policies';
export const TAX_POLICY_ACTIVATION_SWEEP_SCHEDULER_ID =
  'tax-policy-activation-sweep-every-minute';
export const TAX_POLICY_ACTIVATION_SWEEP_INTERVAL_MS = 60_000;

export type TaxPolicyActivationJob = {
  policyVersionId?: string;
  approvalRequestId?: string;
};

export function taxPolicyActivationJob(
  policyVersionId: string,
  approvalRequestId: string,
  effectiveFrom: Date,
) {
  return {
    name: TAX_POLICY_ACTIVATION_JOB_NAME,
    data: { policyVersionId, approvalRequestId },
    options: {
      delay: Math.max(effectiveFrom.getTime() - Date.now(), 0),
      jobId: `${TAX_POLICY_ACTIVATION_JOB_NAME}-${approvalRequestId}`,
      removeOnComplete: true,
      removeOnFail: { count: 500 },
    },
  };
}
