import { ProviderBankAccountStatus, TaxPolicyStatus } from '@prisma/client';

import { ProviderOnboardingService } from './provider-onboarding.service';

describe('ProviderOnboardingService tax policy listing', () => {
  it('keeps admin tax policy history bounded by default', async () => {
    const prisma = {
      taxPolicyVersion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.listTaxPolicyVersions()).resolves.toEqual([]);

    expect(prisma.taxPolicyVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        include: { rules: { orderBy: { createdAt: 'asc' } } },
        take: 20,
      }),
    );
  });

  it('applies bounded pagination for admin tax policy history', async () => {
    const prisma = {
      taxPolicyVersion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await service.listTaxPolicyVersions({ skip: '20', take: '500' });

    expect(prisma.taxPolicyVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 100,
      }),
    );
  });
});

describe('ProviderOnboardingService tax policy effective dates', () => {
  it('rejects tax policy creation when effectiveTo is before effectiveFrom', async () => {
    const prisma = {
      $transaction: vi.fn(),
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createTaxPolicyVersion('admin-1', {
        name: 'Vietnam withholding',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-06-30T23:59:00.000Z',
      }),
    ).rejects.toThrow('effectiveTo must be after effectiveFrom');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects tax policy updates that would create an invalid effective date window', async () => {
    const updatedPolicy = {
      id: 'policy-1',
      name: 'Vietnam withholding',
      status: TaxPolicyStatus.DRAFT,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-06-30T23:59:00.000Z'),
      notes: null,
      createdById: 'admin-1',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      rules: [],
    };
    const tx = {
      taxPolicyVersion: {
        update: vi.fn().mockResolvedValue(updatedPolicy),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.updateTaxPolicyVersion('admin-1', 'policy-1', {
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-06-30T23:59:00.000Z',
      }),
    ).rejects.toThrow('effectiveTo must be after effectiveFrom');

    expect(tx.taxPolicyVersion.updateMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(createdAccount),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(providerProfile),
      },
      providerBankAccount: {
        create: vi.fn().mockResolvedValue(createdAccount),
      },
      providerVerificationLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
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
