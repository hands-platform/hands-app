import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { adminPatchOrThrow, adminPost } from '../../lib/admin-api';
import { enablePushDevice, updatePartnerWalletWithdrawalRequest } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
  adminPost: vi.fn(),
}));

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPost = vi.mocked(adminPost);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('partner server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPost.mockClear();
    mockedAdminPatchOrThrow.mockResolvedValue(undefined);
    mockedAdminPatchOrThrow.mockClear();
    mockedRevalidatePath.mockClear();
  });

  it('re-enables a push device through the shared admin endpoint', async () => {
    const formData = new FormData();
    formData.set('pushDeviceId', ' push-device-1 ');

    await enablePushDevice(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/push-devices/push-device-1/enable', {}, null);
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/partners',
      '/partner-controls',
      '/notifications',
      '/audit-log',
    ]);
  });

  it('requires a push device id before calling the admin API', async () => {
    await expect(enablePushDevice(new FormData())).rejects.toThrow('pushDeviceId is required');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('requires and forwards a separate Finance approver for withdrawal paid closeout', async () => {
    const missingApproval = new FormData();
    missingApproval.set('providerId', 'provider-1');
    missingApproval.set('requestId', 'withdrawal-1');
    missingApproval.set('status', 'PAID');

    await expect(updatePartnerWalletWithdrawalRequest(missingApproval)).rejects.toThrow(
      'Provider wallet withdrawal paid closeout requires approval from a different admin',
    );
    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();

    const formData = new FormData();
    formData.set('providerId', 'provider-1');
    formData.set('requestId', 'withdrawal-1');
    formData.set('status', 'PAID');
    formData.set('approvalAdminId', 'finance-approver-2');
    formData.set('transferRef', 'BANK-OUT-001');

    await updatePartnerWalletWithdrawalRequest(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/withdrawal-requests/withdrawal-1',
      expect.objectContaining({
        approvalAdminId: 'finance-approver-2',
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
      }),
    );
  });
});
