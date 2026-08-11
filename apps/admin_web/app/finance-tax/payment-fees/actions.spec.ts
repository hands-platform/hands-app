import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminPatchOrThrow, adminPostOrThrow } from '../../../lib/admin-api';
import {
  activatePaymentFeePolicy,
  cancelPaymentFeePolicyApproval,
  createPaymentFeePolicyDraft,
  rejectPaymentFeePolicyApproval,
  requestPaymentFeePolicyApproval,
  updatePaymentFeePolicyDraft,
  upsertPaymentFeePolicyRule,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);

describe('payment fee policy actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates only a draft payload and keeps activation out of creation', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'policy-draft-1' });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?period=2026-07&settings=policy',
      name: 'Gateway fees 2026',
      effectiveFrom: '2026-01-01T00:00',
      effectiveTo: '',
      notes: 'Pricing contract evidence',
      reason: 'Create draft from signed gateway contract',
    });

    await createPaymentFeePolicyDraft(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/payment-fee-policies', {
      name: 'Gateway fees 2026',
      effectiveFrom: expect.any(String),
      effectiveTo: null,
      notes: 'Pricing contract evidence',
      reason: 'Create draft from signed gateway contract',
    });
    expect(mockedAdminPostOrThrow.mock.calls[0]?.[1]).not.toHaveProperty('status');
    expect(
      Number.isFinite(
        Date.parse(String((mockedAdminPostOrThrow.mock.calls[0]?.[1] as { effectiveFrom?: string }).effectiveFrom)),
      ),
    ).toBe(true);
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('policyId=policy-draft-1'),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('updates draft metadata without exposing status changes', async () => {
    mockedAdminPatchOrThrow.mockResolvedValue({ id: 'policy-draft-1' });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?period=2026-07&settings=policy&policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      name: 'Gateway fees reviewed',
      effectiveFrom: '2026-01-01T00:00',
      effectiveTo: '2026-12-31T23:30',
      notes: 'Reviewed evidence',
      reason: 'Correct draft dates after contract review',
    });

    await updatePaymentFeePolicyDraft(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1',
      expect.not.objectContaining({ status: expect.anything() }),
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('policyNotice=updated'));
  });

  it('saves a validated per-method rule without activating the policy', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'rule-card' });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?settings=policy&policyId=policy-draft-1&method=CARD',
      policyId: 'policy-draft-1',
      method: 'CARD',
      feeType: 'RATE_PLUS_FIXED',
      rateBps: '150',
      fixedAmount: '1000',
      payer: 'HANDS',
      treatment: 'OPERATING_EXPENSE',
      reason: 'Match signed CARD processing schedule',
    });

    await upsertPaymentFeePolicyRule(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1/rules',
      {
        method: 'CARD',
        feeType: 'RATE_PLUS_FIXED',
        payer: 'HANDS',
        treatment: 'OPERATING_EXPENSE',
        rateBps: 150,
        fixedAmount: 1000,
        reason: 'Match signed CARD processing schedule',
      },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('policyNotice=rule-saved'));
  });

  it('sends separate approver evidence only through the activation endpoint', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'policy-draft-1', status: 'ACTIVE' });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-1',
      approvalAdminId: 'finance-approver-2',
      reason: 'Verified against gateway contract',
    });

    await activatePaymentFeePolicy(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1/activate',
      {
        approvalAdminId: 'finance-approver-2',
        reason: 'Verified against gateway contract',
      },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('policyNotice=activated'));
  });

  it('creates a persistent approval request before activation', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      policyId: 'policy-draft-1',
      status: 'REQUESTED',
    });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-1',
      reason: 'Contract and all seven payment methods reviewed',
    });

    await requestPaymentFeePolicyApproval(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1/approval-request',
      { reason: 'Contract and all seven payment methods reviewed' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('policyNotice=approval-requested'),
    );
  });

  it('records a Finance Approver rejection through the dedicated endpoint', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      policyId: 'policy-draft-1',
      status: 'REJECTED',
    });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-1',
      reason: 'The CARD fee does not match the signed schedule',
    });

    await rejectPaymentFeePolicyApproval(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1/approval-reject',
      { reason: 'The CARD fee does not match the signed schedule' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('policyNotice=approval-rejected'),
    );
  });

  it('lets the requester withdraw review through the dedicated cancel endpoint', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      policyId: 'policy-draft-1',
      status: 'CANCELLED',
    });
    const formData = form({
      returnTo: '/finance-tax/payment-fees?policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-1',
      reason: 'The contract reference must be corrected before review',
    });

    await cancelPaymentFeePolicyApproval(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payment-fee-policies/policy-draft-1/approval-cancel',
      { reason: 'The contract reference must be corrected before review' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('policyNotice=approval-cancelled'),
    );
  });

  it('blocks a stale confirmation that targets a different policy', async () => {
    await activatePaymentFeePolicy(form({
      returnTo: '/finance-tax/payment-fees?period=2026-07&policyId=policy-draft-1&confirm=activate',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-2',
      approvalAdminId: 'finance-approver-2',
      reason: 'Verified against the current gateway contract',
    }));

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/payment-fees?period=2026-07&policyId=policy-draft-1&policyNotice=confirmation-required',
    );
  });

  it('blocks state changes with insufficient decision evidence', async () => {
    await requestPaymentFeePolicyApproval(form({
      returnTo: '/finance-tax/payment-fees?policyId=policy-draft-1',
      policyId: 'policy-draft-1',
      confirmationPolicyId: 'policy-draft-1',
      reason: 'too short',
    }));

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/payment-fees?policyId=policy-draft-1&policyNotice=confirmation-required',
    );
  });
});

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}
