import {
  AdminFinanceOperatorEvidence,
  adminOperatorLabel,
  adminPayoutBatchOperatorEvidenceLines,
  adminWithdrawalOperatorEvidenceLines,
} from './admin-finance-operator-evidence';

describe('AdminFinanceOperatorEvidence', () => {
  it('renders paid executor and separate approver without exposing empty evidence', () => {
    const evidence = AdminFinanceOperatorEvidence({
      lines: adminWithdrawalOperatorEvidenceLines({
        approvalAdmin: { email: 'approver@hands.vn', fullName: 'Finance Approver', id: 'approver-2' },
        approvalAdminId: 'approver-2',
        paidBy: { email: 'maker@hands.vn', fullName: 'Finance Maker', id: 'maker-1' },
        reviewedByAdminId: 'maker-1',
        status: 'PAID',
      }),
    });

    expect(normalizeSpaces(textContent(evidence))).toBe(
      'Paid by Finance Maker Approved by Finance Approver',
    );
  });

  it('falls back from name to email and then stable admin id', () => {
    expect(adminOperatorLabel({ email: 'operator@hands.vn', id: 'operator-1' })).toBe(
      'operator@hands.vn',
    );
    expect(adminOperatorLabel(null, 'operator-2')).toBe('operator-2');
  });

  it('uses update evidence for open batches and dual-approval evidence for paid batches', () => {
    const openLines = adminPayoutBatchOperatorEvidenceLines({
      createdByAdminId: 'creator-1',
      lastUpdatedByAdminId: 'maker-1',
      status: 'PROCESSING',
    });
    const paidLines = adminPayoutBatchOperatorEvidenceLines({
      approvalAdminId: 'approver-2',
      createdByAdminId: 'creator-1',
      paidByAdminId: 'maker-1',
      status: 'PAID',
    });

    expect(openLines.map((line) => line.label)).toEqual(['Created by', 'Updated by']);
    expect(paidLines.map((line) => line.label)).toEqual([
      'Created by',
      'Paid by',
      'Approved by',
    ]);
  });
});

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
