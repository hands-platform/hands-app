export type OperationsPolicyActionState = {
  readonly fieldErrors?: Partial<Record<'confirmationLabel' | 'confirmed' | 'reason' | 'value', string>>;
  readonly message?: string;
  readonly reauthRequired?: boolean;
  readonly status: 'idle' | 'error' | 'success';
  readonly success?: {
    readonly after: string;
    readonly auditId: string | null;
    readonly auditHref: string;
    readonly before: string;
    readonly changedBy: string;
    readonly effectiveAt: string;
    readonly policy: string;
    readonly reason: string;
  };
};

export const initialOperationsPolicyActionState: OperationsPolicyActionState = { status: 'idle' };
