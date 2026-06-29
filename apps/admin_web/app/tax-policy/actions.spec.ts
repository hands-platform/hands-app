import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { adminPatch, adminPost } from '../../lib/admin-api';
import { createTaxPolicyVersion, updateTaxPolicyVersion } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatch);
const mockedAdminPost = vi.mocked(adminPost);
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
    formData.set('name', ' Vietnam withholding ');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', effectiveFrom);
    formData.set('notes', ' Approved policy ');
    formData.set('defaultRateBps', '500');

    await createTaxPolicyVersion(formData);

    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      1,
      '/admin/tax-policy-versions',
      {
        effectiveFrom: effectiveFromIso,
        name: 'Vietnam withholding',
        notes: 'Approved policy',
        status: 'ACTIVE',
      },
      null,
    );
    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      2,
      '/admin/tax-policy-versions/policy-1/rules',
      {
        active: true,
        fixedAmount: 0,
        rateBps: 500,
        scope: 'DEFAULT',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/tax-policy');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('does not create tax policy versions without an effective date', async () => {
    const formData = new FormData();
    formData.set('name', 'Vietnam withholding');

    await expect(createTaxPolicyVersion(formData)).rejects.toThrow('Effective from is required.');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('updates tax policy versions with API-safe effective date windows', async () => {
    const effectiveFrom = '2026-07-01T00:00';
    const effectiveTo = '2026-12-31T23:59';
    const effectiveFromIso = new Date(effectiveFrom).toISOString();
    const effectiveToIso = new Date(effectiveTo).toISOString();

    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', effectiveFrom);
    formData.set('effectiveTo', effectiveTo);
    formData.set('notes', ' Policy reviewed ');

    await updateTaxPolicyVersion(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/tax-policy-versions/policy-1',
      {
        effectiveFrom: effectiveFromIso,
        effectiveTo: effectiveToIso,
        notes: 'Policy reviewed',
        status: 'ACTIVE',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/tax-policy');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('does not update tax policy versions when effective to is before effective from', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('status', 'ACTIVE');
    formData.set('effectiveFrom', '2026-07-01T00:00');
    formData.set('effectiveTo', '2026-06-30T23:59');

    await expect(updateTaxPolicyVersion(formData)).rejects.toThrow(
      'Effective to must be after effective from.',
    );

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
