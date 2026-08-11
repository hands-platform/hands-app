import {
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderLevel,
  Role,
  TaxPolicyStatus,
  VerificationStatus,
} from '@prisma/client';

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
        approvalAdminId: 'finance-admin-2',
        name: 'Vietnam withholding',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-06-30T23:59:00.000Z',
        operatorReason: 'Reviewed against the approved withholding schedule.',
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
        approvalAdminId: 'finance-admin-2',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-06-30T23:59:00.000Z',
        operatorReason: 'Correct the approved policy effective window.',
      }),
    ).rejects.toThrow('effectiveTo must be after effectiveFrom');

    expect(tx.taxPolicyVersion.updateMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

describe('ProviderOnboardingService tax policy finance approval', () => {
  it('requires a different Finance approver before creating a tax policy', async () => {
    const tx = {
      user: {
        findUnique: vi.fn(),
      },
      taxPolicyVersion: {
        create: vi.fn(),
        updateMany: vi.fn(),
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
      service.createTaxPolicyVersion('admin-1', {
        approvalAdminId: 'admin-1',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        name: 'Vietnam withholding',
        operatorReason: 'Approved policy evidence for the next settlement period.',
      }),
    ).rejects.toThrow('Tax policy version create requires a different Finance approver');

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.taxPolicyVersion.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects tax policy approval from an admin without Finance approver authority', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'admin-2',
          roles: [Role.ADMIN],
        }),
      },
      taxPolicyVersion: {
        create: vi.fn(),
        updateMany: vi.fn(),
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
      service.createTaxPolicyVersion('admin-1', {
        approvalAdminId: 'admin-2',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        name: 'Vietnam withholding',
        operatorReason: 'Approved policy evidence for the next settlement period.',
      }),
    ).rejects.toThrow('Tax policy version create requires approval from a Finance approver');

    expect(tx.taxPolicyVersion.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('retains the separate approver and operator evidence in the tax policy audit log', async () => {
    const policy = {
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdById: 'admin-1',
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: null,
      id: 'policy-1',
      name: 'Vietnam withholding',
      notes: null,
      rules: [],
      status: TaxPolicyStatus.DRAFT,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'finance-admin-2',
          roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        }),
      },
      taxPolicyVersion: {
        create: vi.fn().mockResolvedValue(policy),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createTaxPolicyVersion('admin-1', {
        approvalAdminId: 'finance-admin-2',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        name: 'Vietnam withholding',
        operatorReason: 'Approved policy evidence for the next settlement period.',
      }),
    ).resolves.toEqual(policy);

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'tax_policy.create',
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          operatorReason: 'Approved policy evidence for the next settlement period.',
        }),
        target: 'tax_policy:policy-1',
      }),
    });
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

describe('ProviderOnboardingService Partner review notifications', () => {
  it('approves submitted required documents with the single overall KYC decision', async () => {
    const prisma = providerReviewPrisma();
    prisma.providerKyc.findUnique.mockResolvedValue({ status: ProviderKycStatus.PENDING });
    prisma.providerKyc.upsert.mockResolvedValue({ id: 'kyc-1', status: ProviderKycStatus.APPROVED });
    prisma.providerDocument.findMany.mockResolvedValue([
      { type: ProviderDocumentType.CCCD_FRONT },
      { type: ProviderDocumentType.CCCD_BACK },
      { type: ProviderDocumentType.SELFIE },
    ]);
    const service = new ProviderOnboardingService(prisma as never);

    await service.reviewKyc('admin-1', 'provider-1', ProviderKycStatus.APPROVED);

    expect(prisma.providerDocument.findMany).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'provider-1',
        type: {
          in: [
            ProviderDocumentType.CCCD_FRONT,
            ProviderDocumentType.CCCD_BACK,
            ProviderDocumentType.SELFIE,
          ],
        },
        deletedAt: null,
        fileAsset: { uploadStatus: 'UPLOADED' },
      },
      select: { type: true },
    });
    expect(prisma.providerDocument.updateMany).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'provider-1',
        type: {
          in: [
            ProviderDocumentType.CCCD_FRONT,
            ProviderDocumentType.CCCD_BACK,
            ProviderDocumentType.SELFIE,
          ],
        },
        deletedAt: null,
      },
      data: {
        status: ProviderDocumentStatus.APPROVED,
        reviewedAt: expect.any(Date),
        rejectionReason: null,
      },
    });
  });

  it('places the whole KYC review on hold and sends the reason to the Partner', async () => {
    const prisma = providerReviewPrisma();
    prisma.providerKyc.findUnique.mockResolvedValue({ status: ProviderKycStatus.PENDING });
    prisma.providerKyc.upsert.mockResolvedValue({ id: 'kyc-1', status: ProviderKycStatus.BLOCKED });
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new ProviderOnboardingService(prisma as never, notifications as never);

    await service.reviewKyc(
      'admin-1',
      'provider-1',
      ProviderKycStatus.BLOCKED,
      'Please upload a clearer CCCD front photo.',
    );

    expect(prisma.providerVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: VerificationStatus.SUBMITTED }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'provider.kyc.on_hold',
        title: 'Identity verification on hold',
        body: expect.stringContaining('Please upload a clearer CCCD front photo.'),
        data: expect.objectContaining({
          resubmissionRequired: true,
          reviewReason: 'Please upload a clearer CCCD front photo.',
          reviewStatus: ProviderKycStatus.BLOCKED,
        }),
      }),
    );
  });

  it('sends the KYC rejection reason and resubmission request to the Partner', async () => {
    const prisma = providerReviewPrisma();
    prisma.providerKyc.findUnique.mockResolvedValue({ status: ProviderKycStatus.PENDING });
    prisma.providerKyc.upsert.mockResolvedValue({ id: 'kyc-1', status: ProviderKycStatus.REJECTED });
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new ProviderOnboardingService(prisma as never, notifications as never);

    await service.reviewKyc(
      'admin-1',
      'provider-1',
      ProviderKycStatus.REJECTED,
      'The selfie does not clearly match the submitted ID.',
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user-1',
        targetRole: Role.PROVIDER,
        type: 'provider.kyc.rejected',
        title: 'Identity verification needs correction',
        body: expect.stringContaining('The selfie does not clearly match the submitted ID.'),
        data: expect.objectContaining({
          resubmissionRequired: true,
          reviewReason: 'The selfie does not clearly match the submitted ID.',
        }),
      }),
    );
  });

  it('sends a rejected document reason from the Partner detail review flow', async () => {
    const prisma = providerReviewPrisma();
    prisma.providerDocument.findUniqueOrThrow.mockResolvedValue({
      id: 'document-1',
      providerProfileId: 'provider-1',
      status: ProviderDocumentStatus.PENDING_REVIEW,
      providerProfile: { userId: 'provider-user-1' },
    });
    prisma.providerDocument.update.mockResolvedValue({
      id: 'document-1',
      providerProfileId: 'provider-1',
      fileAssetId: 'file-1',
      type: ProviderDocumentType.CCCD_FRONT,
      status: ProviderDocumentStatus.REJECTED,
      fileAsset: { id: 'file-1' },
    });
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-2' }) };
    const service = new ProviderOnboardingService(prisma as never, notifications as never);

    await service.reviewProviderDocument(
      'admin-1',
      'document-1',
      ProviderDocumentStatus.REJECTED,
      'The ID number is blurred. Upload a clearer photo.',
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user-1',
        targetRole: Role.PROVIDER,
        type: 'provider.document.rejected',
        title: 'ID card front needs correction',
        body: expect.stringContaining('Upload a clearer photo.'),
        data: expect.objectContaining({ documentId: 'document-1', resubmissionRequired: true }),
      }),
    );
  });
});

describe('ProviderOnboardingService partner payout setup snapshot', () => {
  it('exposes a rejected bank account correction request to the partner app', async () => {
    const reviewedAt = new Date('2026-06-28T09:30:00.000Z');
    const updatedAt = new Date('2026-06-28T09:35:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          userId: 'provider-user-1',
          level: ProviderLevel.LEVEL_2_ACTIVE,
          displayName: 'Smoke Partner',
          legalName: 'Smoke Partner Legal',
          dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
          gender: 'female',
          facebookId: null,
          activityNickname: 'Smoke',
          bio: 'Approved partner',
          experienceYears: 4,
          specialties: [],
          languages: [],
          serviceStyle: null,
          residentialAddress: 'Cau Giay, Ha Noi',
          city: 'Ha Noi',
          serviceArea: null,
          verification: { status: VerificationStatus.APPROVED },
          kyc: { status: ProviderKycStatus.APPROVED },
          documents: [
            {
              type: ProviderDocumentType.CCCD_FRONT,
              status: ProviderDocumentStatus.APPROVED,
              deletedAt: null,
            },
            {
              type: ProviderDocumentType.CCCD_BACK,
              status: ProviderDocumentStatus.APPROVED,
              deletedAt: null,
            },
            {
              type: ProviderDocumentType.PORTRAIT,
              status: ProviderDocumentStatus.APPROVED,
              deletedAt: null,
            },
          ],
          bankAccounts: [
            {
              id: 'bank-rejected',
              status: ProviderBankAccountStatus.REJECTED,
              isPrimary: true,
              rejectionReason: 'Account holder name does not match KYC.',
              reviewedAt,
              updatedAt,
              deletedAt: null,
            },
          ],
          taxProfile: null,
          agreements: [
            { type: ProviderAgreementType.PAYOUT_TERMS },
            { type: ProviderAgreementType.TAX_WITHHOLDING },
          ],
          verificationLogs: [],
        }),
      },
      booking: {
        count: vi.fn().mockResolvedValue(1),
      },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.getSnapshot('provider-user-1')).resolves.toMatchObject({
      payoutGate: {
        bankCorrectionRequest: {
          required: true,
          action: 'UPDATE_BANK_ACCOUNT',
          bankAccountId: 'bank-rejected',
          message: '입금 정보가 정확하지 않아 입금이 되지 않습니다.',
          reason: 'Account holder name does not match KYC.',
          reviewedAt,
          updatedAt,
        },
      },
      nextRequiredActions: expect.arrayContaining(['BANK_ACCOUNT_CORRECTION']),
    });
  });
});

function providerReviewPrisma() {
  const readinessProvider = {
    id: 'provider-1',
    userId: 'provider-user-1',
    displayName: 'Linh Partner',
    legalName: 'Linh Legal',
    residentialAddress: 'Ho Chi Minh City',
    level: ProviderLevel.LEVEL_1_SIGNUP,
    verification: { status: VerificationStatus.REJECTED },
    kyc: { status: ProviderKycStatus.REJECTED },
    bankAccounts: [],
    taxProfile: null,
    documents: [],
    agreements: [],
  };

  return {
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    booking: { count: vi.fn().mockResolvedValue(0) },
    providerDocument: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    providerKyc: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    providerProfile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(readinessProvider),
      update: vi.fn().mockResolvedValue(readinessProvider),
    },
    providerVerification: { upsert: vi.fn().mockResolvedValue({ id: 'verification-1' }) },
    providerVerificationLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
  };
}
