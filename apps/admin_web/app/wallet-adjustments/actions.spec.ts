import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { AdminApiRequestError, adminGetResult, adminPostOrThrow } from '../../lib/admin-api';
import {
  createManualWalletAdjustment,
  previewManualWalletAdjustment,
  searchWalletAdjustmentOwners,
  submitManualWalletAdjustmentRequest,
} from './actions';
import * as walletAdjustmentActions from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/admin-api')>();
  return {
    ...actual,
    adminGetResult: vi.fn(),
    adminPostOrThrow: vi.fn(),
    isAdminApiAuthError: vi.fn((error: unknown) => error instanceof Error && error.message === 'auth'),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

function validPartnerForm() {
  const formData = new FormData();
  formData.set('ownerType', 'PARTNER');
  formData.set('ownerId', 'provider-1');
  formData.set('direction', 'CREDIT');
  formData.set('adjustmentType', 'PARTNER_BONUS');
  formData.set('amount', '200000');
  formData.set('reason', 'Quality bonus approved by operations');
  formData.set('operationalCause', 'Partner service quality recovery');
  formData.set('expectedCorrection', 'Credit the approved bonus once');
  formData.set('monthlyPeriod', '2026-08');
  formData.set('idempotencyKey', '00000000-0000-4000-8000-000000000001');
  return formData;
}

describe('wallet adjustment server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'wallet-request-1' });
    mockedAdminGetResult.mockResolvedValue({ data: [], ok: true, status: 200 });
  });

  it('creates a request with body-only draft values and redirects with only safe identifiers', async () => {
    const formData = validPartnerForm();
    formData.set('attachmentUrl', 'https://evidence.example.test/object-1');

    await submitManualWalletAdjustmentRequest({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/wallet-adjustment-requests', {
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      attachmentUrl: 'https://evidence.example.test/object-1',
      direction: 'CREDIT',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      monthlyPeriod: '2026-08',
      operationalCause: 'Partner service quality recovery',
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      expectedCorrection: 'Credit the approved bonus once',
      reason: 'Quality bonus approved by operations',
    });
    const target = String(mockedRedirect.mock.calls[0]?.[0]);
    expect(target).toContain('view=requests');
    expect(target).toContain('requestId=wallet-request-1');
    for (const sensitive of ['provider-1', '200000', 'Quality+bonus', 'evidence.example']) {
      expect(target).not.toContain(sensitive);
    }
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
  });

  it('keeps validation and API failures in local action state without a sensitive redirect', async () => {
    const invalid = validPartnerForm();
    invalid.set('amount', '1000000001');
    invalid.set('reason', 'Sensitive reason that must not enter history');
    const validation = await submitManualWalletAdjustmentRequest({ status: 'idle' }, invalid);

    expect(validation).toMatchObject({ code: 'AMOUNT_TOO_HIGH', field: 'amount', status: 'error' });
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();

    mockedAdminPostOrThrow.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/wallet-adjustment-requests', 400, {
        code: 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED',
      }),
    );
    const apiFailure = await submitManualWalletAdjustmentRequest({ status: 'idle' }, validPartnerForm());
    expect(apiFailure).toMatchObject({
      code: 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED',
      field: 'adjustmentType',
      status: 'error',
    });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('uses POST preview and returns a payload key without navigating', async () => {
    mockedAdminPostOrThrow.mockResolvedValueOnce({
      accountingEntries: [],
      adjustmentType: 'PARTNER_BONUS',
      affects: { bankCash: false, expense: true, partnerReceivable: false, revenue: false, taxPayable: false, walletLiability: true },
      afterBalance: 200000,
      amount: 200000,
      bankCashAmount: 0,
      beforeBalance: 0,
      companyOutputVat: 0,
      currency: 'VND',
      direction: 'CREDIT',
      expenseAmount: 200000,
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      platformRevenueAmount: 0,
      reason: 'Quality bonus approved by operations',
      requiresApproval: true,
      requiresAttachment: false,
      revenueAmount: 0,
      walletDelta: 200000,
    });

    const state = await previewManualWalletAdjustment({ status: 'idle' }, validPartnerForm());

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/wallet-adjustments/preview',
      expect.not.objectContaining({ idempotencyKey: expect.anything() }),
    );
    expect(state.status).toBe('success');
    expect(state.inputKey).toContain('ownerId:provider-1');
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('rejects unsafe evidence, settlement-only creation, and source-less reversals before API access', async () => {
    const unsafe = validPartnerForm();
    unsafe.set('attachmentUrl', 'javascript:alert(1)');
    expect(await previewManualWalletAdjustment({ status: 'idle' }, unsafe)).toMatchObject({
      code: 'ATTACHMENT_INVALID',
      field: 'attachmentUrl',
    });

    const settlement = validPartnerForm();
    settlement.set('adjustmentType', 'CASH_BOOKING_DEDUCTION');
    expect(await previewManualWalletAdjustment({ status: 'idle' }, settlement)).toMatchObject({
      code: 'WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED',
    });

    const reversal = validPartnerForm();
    reversal.set('adjustmentType', 'MANUAL_REVERSAL');
    expect(await previewManualWalletAdjustment({ status: 'idle' }, reversal)).toMatchObject({
      code: 'WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED',
    });
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('searches owners server-side without placing name or phone in the browser URL', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({
      data: [{
        accountStatus: 'APPROVED', currency: 'VND', currentBalance: 100000, displayName: 'Partner One',
        maskedPhone: '+84•••1234', ownerId: 'provider-1', ownerType: 'PARTNER', reference: 'Partner •••der-1',
      }],
      ok: true,
      status: 200,
    });
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerSearch', 'Partner One');

    const state = await searchWalletAdjustmentOwners({ owners: [], status: 'idle' }, formData);

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustments/owners?ownerType=PARTNER&q=Partner+One&take=10',
      [],
    );
    expect(state.status).toBe('success');
    expect(state.ownerType).toBe('PARTNER');
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('preserves the allowlisted customer-detail return without adding draft values', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'CUSTOMER');
    formData.set('ownerId', 'customer-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'CUSTOMER_COMPENSATION');
    formData.set('amount', '100000');
    formData.set('reason', 'Customer service compensation');
    formData.set('operationalCause', 'Confirmed customer support case');
    formData.set('expectedCorrection', 'Credit the approved compensation once');
    formData.set('monthlyPeriod', '2026-08');
    formData.set('redirectTo', '/customers/customer-1#customer-wallet-adjustment-request');

    await createManualWalletAdjustment(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/customers/customer-1?walletAdjustmentNotice=requested#customer-wallet-adjustment-request',
    );
  });

  it('exports only async server actions', () => {
    expect(Object.values(walletAdjustmentActions).every((value) => typeof value === 'function')).toBe(true);
  });
});
