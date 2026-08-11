import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminProvider } from '../../lib/admin-api';
import { adminGet, adminPatchOrThrow, adminPost, adminPostOrThrow } from '../../lib/admin-api';
import {
  approveProvider,
  approveProviderKyc,
  blockProviderAccount,
  enablePushDevice,
  putProviderKycOnHold,
  updatePartnerWalletWithdrawalRequest,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('../../lib/admin-api', () => ({
  adminGet: vi.fn(),
  adminPatchOrThrow: vi.fn(),
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPost = vi.mocked(adminPost);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

describe('partner server actions', () => {
  beforeEach(() => {
    mockedAdminGet.mockResolvedValue([]);
    mockedAdminGet.mockClear();
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPost.mockClear();
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
    mockedAdminPostOrThrow.mockClear();
    mockedAdminPatchOrThrow.mockResolvedValue(undefined);
    mockedAdminPatchOrThrow.mockClear();
    mockedRevalidatePath.mockClear();
    mockedRedirect.mockClear();
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

  it('uses the authenticated operator for withdrawal paid closeout and ignores browser evidence', async () => {
    const formData = new FormData();
    formData.set('providerId', 'provider-1');
    formData.set('requestId', 'withdrawal-1');
    formData.set('status', 'PAID');
    formData.set('approvalAdminId', 'finance-approver-2');
    formData.set('transferRef', 'MALICIOUS-REPLACEMENT');

    await updatePartnerWalletWithdrawalRequest(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/withdrawal-requests/withdrawal-1',
      { status: 'PAID' },
    );
  });

  it('keeps a queue-based KYC approval on the same Partner until final approval', async () => {
    const formData = new FormData();
    formData.set('providerId', 'current-partner');
    formData.set('decisionQueue', 'approval-pending');

    await approveProviderKyc(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/partners/current-partner/kyc/approve',
      {},
    );
    expect(mockedAdminGet).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('returns to the approval queue when a hold leaves no other pending Partner', async () => {
    mockedAdminGet.mockResolvedValue([{ id: 'current-partner' } as AdminProvider]);
    const formData = new FormData();
    formData.set('providerId', 'current-partner');
    formData.set('decisionQueue', 'approval-pending');
    formData.set('reason', 'Please upload a clearer identity photo.');

    await expect(putProviderKycOnHold(formData)).rejects.toThrow(
      'NEXT_REDIRECT:/partners?review=approval-pending&sort=oldest',
    );

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/partners/current-partner/kyc/hold',
      { reason: 'Please upload a clearer identity photo.' },
    );
  });

  it('keeps direct Partner detail decisions on the current page outside the queue', async () => {
    const formData = new FormData();
    formData.set('providerId', 'current-partner');

    await approveProviderKyc(formData);

    expect(mockedAdminGet).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('uses the same next-oldest flow for final Partner approval and approval hold', async () => {
    mockedAdminGet.mockResolvedValue([{ id: 'next-partner' } as AdminProvider]);
    const approveForm = new FormData();
    approveForm.set('providerId', 'current-partner');
    approveForm.set('decisionQueue', 'approval-pending');

    await expect(approveProvider(approveForm)).rejects.toThrow(
      'NEXT_REDIRECT:/partners/next-partner?decisionQueue=approval-pending',
    );
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/partners/current-partner/approve',
      {},
    );

    mockedAdminGet.mockResolvedValue([]);
    const holdForm = new FormData();
    holdForm.set('providerId', 'current-partner');
    holdForm.set('decisionQueue', 'approval-pending');
    holdForm.set('reason', 'Identity correction must be completed first.');

    await expect(blockProviderAccount(holdForm)).rejects.toThrow(
      'NEXT_REDIRECT:/partners?review=approval-pending&sort=oldest',
    );
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/partners/current-partner/block',
      { reason: 'Identity correction must be completed first.' },
    );
  });
});
