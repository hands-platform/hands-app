import { ProviderBankAccountStatus } from '@prisma/client';

import { ProviderOnboardingService } from './provider-onboarding.service';

describe('ProviderOnboardingService bank account submission', () => {
  it('makes a resubmitted bank account the only active primary account', async () => {
    const providerProfile = {
      id: 'provider-1',
      userId: 'provider-user-1',
      bankAccounts: [
        {
          id: 'bank-old',
          status: ProviderBankAccountStatus.REJECTED,
          isPrimary: true,
          deletedAt: null,
        },
      ],
      verification: null,
      kyc: null,
      documents: [],
      taxProfile: null,
      agreements: [],
      verificationLogs: [],
    };
    const createdAccount = {
      id: 'bank-new',
      providerProfileId: 'provider-1',
      bankName: 'Vietcombank',
      accountNumberMasked: '*****6789',
      accountNumberLast4: '6789',
      accountHolderName: 'Linh Tran',
      qrBankingInfo: null,
      status: ProviderBankAccountStatus.PENDING_REVIEW,
      isPrimary: true,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date('2026-06-22T09:00:00.000Z'),
      updatedAt: new Date('2026-06-22T09:00:00.000Z'),
      deletedAt: null,
    };
    const tx = {
      providerBankAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(createdAccount),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(providerProfile),
      },
      providerBankAccount: {
        create: jest.fn().mockResolvedValue(createdAccount),
      },
      providerVerificationLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createBankAccount('provider-user-1', {
        bankName: ' Vietcombank ',
        accountNumber: '12345 6789',
        accountHolderName: ' Linh Tran ',
      }),
    ).resolves.toEqual({ ok: true, bankAccount: createdAccount });

    expect(tx.providerBankAccount.updateMany).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1', isPrimary: true, deletedAt: null },
      data: { isPrimary: false },
    });
    expect(tx.providerBankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerProfileId: 'provider-1',
        bankName: 'Vietcombank',
        accountNumberMasked: '*****6789',
        accountNumberLast4: '6789',
        accountHolderName: 'Linh Tran',
        status: ProviderBankAccountStatus.PENDING_REVIEW,
        isPrimary: true,
      }),
    });
    expect(prisma.providerBankAccount.create).not.toHaveBeenCalled();
    expect(prisma.providerVerificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerProfileId: 'provider-1',
          action: 'bank_account.submit',
          toStatus: ProviderBankAccountStatus.PENDING_REVIEW,
        }),
      }),
    );
  });
});
