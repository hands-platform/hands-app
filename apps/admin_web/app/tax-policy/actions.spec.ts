import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch, adminPost } from '../../lib/admin-api';
import { createTaxPolicyVersion, createTaxRule, updateTaxPolicyVersion, updateTaxRule } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatch);
const mockedAdminPost = vi.mocked(adminPost);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('tax policy server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatch.mockResolvedValue(undefined);
    mockedAdminPost.mockResolvedValue(null);
  });

  it('creates tax policy versions with API-safe effective dates', async () => {
    const effectiveFrom = '2026-07-01T09:30';
    const effectiveFromIso = new Date(effectiveFrom).toISOString();
    mockedAdminPost.mockResolvedValueOnce({
      id: 'policy-1',
      name: 'Vietnam withholding',
      status: 'ACTIVE',
      effectiveFrom: effectiveFromIso,
      effectiveTo: null,
      notes: 'Approved policy',
      rules: [],
    });

    const formData = new FormData();
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('name', ' Vietnam withholding ');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', effectiveFrom);
    formData.set('notes', ' Approved policy ');
    formData.set('operatorReason', 'Reviewed against the approved withholding schedule.');
    formData.set('defaultRateBps', '500');

    await createTaxPolicyVersion(formData);

    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      1,
      '/admin/tax-policy-versions',
      {
        approvalAdminId: 'finance-admin-2',
        effectiveFrom: effectiveFromIso,
        name: 'Vietnam withholding',
        notes: 'Approved policy',
        operatorReason: 'Reviewed against the approved withholding schedule.',
        status: 'ACTIVE',
      },
      null,
    );
    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      2,
      '/admin/tax-policy-versions/policy-1/rules',
      {
        active: true,
        approvalAdminId: 'finance-admin-2',
        fixedAmount: 0,
        operatorReason: 'Reviewed against the approved withholding schedule.',
        rateBps: 500,
        scope: 'DEFAULT',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/tax-policy');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('redirects to a form notice without creating tax policy versions when the effective date is missing', async () => {
    const formData = new FormData();
    formData.set('name', 'Vietnam withholding');

    await createTaxPolicyVersion(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=validation&message=Effective%20from%20is%20required.',
    );
  });

  it('updates tax policy versions with API-safe effective date windows', async () => {
    const effectiveFrom = '2026-07-01T00:00';
    const effectiveTo = '2026-12-31T23:59';
    const effectiveFromIso = new Date(effectiveFrom).toISOString();
    const effectiveToIso = new Date(effectiveTo).toISOString();

    const formData = new FormData();
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('policyId', 'policy-1');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', effectiveFrom);
    formData.set('effectiveTo', effectiveTo);
    formData.set('notes', ' Policy reviewed ');
    formData.set('operatorReason', 'Reviewed the policy dates and retained settlement evidence.');

    await updateTaxPolicyVersion(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/tax-policy-versions/policy-1',
      {
        approvalAdminId: 'finance-admin-2',
        effectiveFrom: effectiveFromIso,
        effectiveTo: effectiveToIso,
        notes: 'Policy reviewed',
        operatorReason: 'Reviewed the policy dates and retained settlement evidence.',
        status: 'ACTIVE',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/tax-policy');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('redirects to a form notice without updating tax policy versions when effective to is before effective from', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', '2026-07-01T00:00');
    formData.set('effectiveTo', '2026-06-30T23:59');

    await updateTaxPolicyVersion(formData);

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=validation&message=Effective%20to%20must%20be%20after%20effective%20from.',
    );
  });

  it('redirects to a form notice without creating service-type tax rules when service type is missing', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('scope', 'SERVICE_TYPE');
    formData.set('rateBps', '500');

    await createTaxRule(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=validation&message=SERVICE_TYPE%20tax%20rules%20require%20service%20type.',
    );
  });

  it('redirects to a form notice without creating amount-band tax rules when amount bounds are missing', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('scope', 'AMOUNT_BAND');
    formData.set('rateBps', '500');

    await createTaxRule(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=validation&message=AMOUNT_BAND%20tax%20rules%20require%20min%20or%20max%20amount.',
    );
  });

  it('redirects to a form notice without updating tax rules when min amount is greater than max amount', async () => {
    const formData = new FormData();
    formData.set('ruleId', 'rule-1');
    formData.set('scope', 'AMOUNT_BAND');
    formData.set('minGrossAmount', '900000');
    formData.set('maxGrossAmount', '300000');
    formData.set('rateBps', '500');

    await updateTaxRule(formData);

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=validation&message=Min%20amount%20cannot%20be%20greater%20than%20max%20amount.',
    );
  });
});
