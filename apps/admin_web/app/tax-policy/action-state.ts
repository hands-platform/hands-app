export type TaxPolicyActionState = {
  readonly code?: string;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly status: 'error' | 'idle';
  readonly values?: Record<string, string>;
};

export const INITIAL_TAX_POLICY_ACTION_STATE: TaxPolicyActionState = { status: 'idle' };
