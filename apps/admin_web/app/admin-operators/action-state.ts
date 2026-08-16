export type AdminOperatorActionState = {
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly receipt?: {
    readonly auditId?: string;
    readonly message: string;
    readonly mfaSecret?: string;
    readonly otpAuthUri?: string;
    readonly recoveryCodes?: readonly string[];
    readonly setupPath?: string;
  };
  readonly status: 'idle' | 'error' | 'success';
};

export const INITIAL_ADMIN_OPERATOR_ACTION_STATE: AdminOperatorActionState = { status: 'idle' };
