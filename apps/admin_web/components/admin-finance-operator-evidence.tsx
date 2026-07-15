import type { AdminOperatorIdentity } from '../lib/admin-api';

export type AdminFinanceOperatorEvidenceLine = {
  readonly fallbackId?: string | null;
  readonly key: string;
  readonly label: string;
  readonly operator?: AdminOperatorIdentity | null;
};

type AdminFinanceOperatorEvidenceProps = {
  readonly lines: readonly AdminFinanceOperatorEvidenceLine[];
};

type WithdrawalOperatorEvidenceSource = {
  readonly approvalAdmin?: AdminOperatorIdentity | null;
  readonly approvalAdminId?: string | null;
  readonly paidBy?: AdminOperatorIdentity | null;
  readonly reviewedBy?: AdminOperatorIdentity | null;
  readonly reviewedByAdminId?: string | null;
  readonly status: string;
};

type PayoutBatchOperatorEvidenceSource = {
  readonly approvalAdmin?: AdminOperatorIdentity | null;
  readonly approvalAdminId?: string | null;
  readonly createdBy?: AdminOperatorIdentity | null;
  readonly createdByAdminId?: string | null;
  readonly lastUpdatedBy?: AdminOperatorIdentity | null;
  readonly lastUpdatedByAdminId?: string | null;
  readonly paidBy?: AdminOperatorIdentity | null;
  readonly paidByAdminId?: string | null;
  readonly status: string;
};

export function AdminFinanceOperatorEvidence({ lines }: AdminFinanceOperatorEvidenceProps) {
  const visibleLines = lines.filter((line) => line.operator || line.fallbackId);
  if (visibleLines.length === 0) {
    return null;
  }

  return (
    <>
      {visibleLines.map((line) => (
        <p className="muted" key={line.key}>
          {line.label} {adminOperatorLabel(line.operator, line.fallbackId)}
        </p>
      ))}
    </>
  );
}

export function adminWithdrawalOperatorEvidenceLines(
  request: WithdrawalOperatorEvidenceSource,
): AdminFinanceOperatorEvidenceLine[] {
  if (request.status === 'PAID') {
    return [
      {
        fallbackId: request.reviewedByAdminId,
        key: 'paid-by',
        label: 'Paid by',
        operator: request.paidBy ?? request.reviewedBy,
      },
      {
        fallbackId: request.approvalAdminId,
        key: 'approved-by',
        label: 'Approved by',
        operator: request.approvalAdmin,
      },
    ];
  }

  return [
    {
      fallbackId: request.reviewedByAdminId,
      key: 'reviewed-by',
      label: 'Reviewed by',
      operator: request.reviewedBy,
    },
  ];
}

export function adminPayoutBatchOperatorEvidenceLines(
  batch: PayoutBatchOperatorEvidenceSource,
): AdminFinanceOperatorEvidenceLine[] {
  return [
    {
      fallbackId: batch.createdByAdminId,
      key: 'created-by',
      label: 'Created by',
      operator: batch.createdBy,
    },
    ...(batch.status === 'PAID'
      ? [
          {
            fallbackId: batch.paidByAdminId,
            key: 'paid-by',
            label: 'Paid by',
            operator: batch.paidBy,
          },
          {
            fallbackId: batch.approvalAdminId,
            key: 'approved-by',
            label: 'Approved by',
            operator: batch.approvalAdmin,
          },
        ]
      : [
          {
            fallbackId: batch.lastUpdatedByAdminId,
            key: 'updated-by',
            label: 'Updated by',
            operator: batch.lastUpdatedBy,
          },
        ]),
  ];
}

export function adminOperatorLabel(
  operator: AdminOperatorIdentity | null | undefined,
  fallbackId?: string | null,
) {
  return operator?.fullName ?? operator?.email ?? fallbackId ?? 'Unknown operator';
}
