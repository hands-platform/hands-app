import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderLevel,
  ProviderTaxProfileStatus,
  Role,
  TaxPolicyApprovalStatus,
  TaxPolicyLifecycleStatus,
  TaxPolicyProvenance,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} from '@prisma/client';

import { ProviderOnboardingService } from './provider-onboarding.service';

const taxPolicyLegalMetadata = {
  changeSummary: 'Create the reviewed Vietnam withholding schedule.',
  legalSourceTitle: 'Vietnam personal income tax withholding guidance',
  legalSourceUrl: 'https://example.gov.vn/tax/withholding',
  promulgatedDate: '2026-06-01T00:00:00.000Z',
  taxSubject: 'Individual massage therapist service income',
};

function approvalReadyTaxPolicy() {
  return {
    id: 'policy-governed-1',
    name: 'Vietnam withholding governed policy',
    status: TaxPolicyStatus.DRAFT,
    lifecycleStatus: TaxPolicyLifecycleStatus.DRAFT,
    provenance: TaxPolicyProvenance.OPERATOR,
    jurisdiction: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveTo: null,
    notes: null,
    legalSourceTitle: taxPolicyLegalMetadata.legalSourceTitle,
    legalSourceUrl: taxPolicyLegalMetadata.legalSourceUrl,
    promulgatedDate: new Date(taxPolicyLegalMetadata.promulgatedDate),
    taxSubject: taxPolicyLegalMetadata.taxSubject,
    changeSummary: taxPolicyLegalMetadata.changeSummary,
    supersedesPolicyVersionId: null,
    revision: 1,
    payloadHash: null as string | null,
    createdById: 'maker-1',
    approvedByAdminId: null,
    approvedAt: null,
    activatedAt: null,
    supersededAt: null,
    archivedAt: null,
    createdAt: new Date('2026-08-12T00:00:00.000Z'),
    updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    rules: [
      {
        id: 'rule-default-1',
        policyVersionId: 'policy-governed-1',
        scope: 'DEFAULT' as const,
        serviceType: null,
        minGrossAmount: null,
        maxGrossAmount: null,
        taxKind: 'PARTNER_WITHHOLDING_COMBINED' as const,
        category: null,
        collectionMode: null,
        rateBps: 500,
        fixedAmount: 0,
        active: true,
        createdAt: new Date('2026-08-12T00:00:00.000Z'),
        updatedAt: new Date('2026-08-12T00:00:00.000Z'),
      },
    ],
    _count: { taxLogs: 0, bookingSettlementSnapshots: 0 },
  };
}

function verifiedTaxPolicyActor(id: string, financeApprover = false) {
  const now = new Date('2026-08-12T00:00:00.000Z');
  return {
    id,
    email: `${id}@hands.test`,
    fullName: id,
    roles: financeApprover ? [Role.ADMIN, Role.FINANCE_APPROVER] : [Role.ADMIN],
    updatedAt: now,
    adminUserProvenance: AdminUserProvenance.PRODUCTION,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: {
      disabledAt: null,
      lastLoginAt: now,
      lockedUntil: null,
      mfaState: 'VERIFIED',
      setupCompletedAt: now,
    },
    adminOperatorPermission: {
      categories: [AdminOperatorPermissionCategory.FINANCE_TAX],
      updatedAt: now,
      version: 1,
    },
    financeApproverRequestsTargeted: financeApprover
      ? [{ executedAt: now, id: `grant-${id}`, requestedEnabled: true }]
      : [],
  };
}

function governedTaxPolicyAccess(
  actorId: string,
  financeApprover = false,
  independentCheckers: ReturnType<typeof verifiedTaxPolicyActor>[] = [],
) {
  const actor = verifiedTaxPolicyActor(actorId, financeApprover);
  return {
    adminWebSession: {
      findUnique: vi.fn().mockResolvedValue({
        expiresAt: new Date(Date.now() + 60 * 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: actorId,
      }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(actor),
      findMany: vi.fn().mockResolvedValue(independentCheckers),
      findUnique: vi.fn().mockResolvedValue(actor),
    },
  };
}

function recentTaxPolicyAssurance() {
  return { mfaVerifiedAt: new Date(), sessionId: 'tax-policy-session-1' };
}

describe('ProviderOnboardingService tax policy listing', () => {
  it('keeps admin tax policy history bounded by default', async () => {
    const prisma = {
      taxPolicyVersion: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(145),
      },
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.listTaxPolicyVersions()).resolves.toEqual({
      items: [],
      total: 145,
      skip: 0,
      take: 20,
    });

    expect(prisma.taxPolicyVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        include: expect.objectContaining({ rules: { orderBy: { createdAt: 'asc' } } }),
        take: 20,
      }),
    );
  });

  it('applies bounded pagination for admin tax policy history', async () => {
    const prisma = {
      taxPolicyVersion: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(145),
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

  it('returns exact Tax Policy audit events with a real total', async () => {
    const auditRow = {
      id: 'audit-1',
      action: 'tax_policy.activated',
      target: 'tax_policy:policy-1',
      createdAt: new Date('2026-08-12T00:00:00.000Z'),
    };
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([auditRow]),
        count: vi.fn().mockResolvedValue(725),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.listTaxPolicyAuditLogs('admin-1', { take: '25' })).resolves.toEqual({
      items: [auditRow],
      total: 725,
      skip: 0,
      take: 25,
    });
    expect(tx.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{
            OR: [
              { action: { startsWith: 'tax_policy.' } },
              { action: { startsWith: 'tax_rule.' } },
            ],
          }]),
        }),
      }),
    );
  });

  it('filters a policy audit by exact target or metadata policyVersionId', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await service.listTaxPolicyAuditLogs('admin-1', { policyVersionId: 'policy-1' });

    expect(tx.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { target: 'tax_policy:policy-1' },
                { metadata: { path: ['policyVersionId'], equals: 'policy-1' } },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it('loads an exact audit event and returns its governed source provenance', async () => {
    const auditRow = {
      id: 'audit-legacy-1',
      action: 'tax_policy.activated',
      target: 'tax_policy:policy-legacy-1',
      metadata: { policyVersionId: 'policy-legacy-1' },
      createdAt: new Date('2026-08-12T00:00:00.000Z'),
    };
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      taxPolicyVersion: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'policy-legacy-1',
          provenance: TaxPolicyProvenance.MIGRATION,
        }]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([auditRow]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.listTaxPolicyAuditLogs('admin-1', {
      eventId: 'audit-legacy-1',
      source: 'legacy',
      take: '1',
    })).resolves.toEqual({
      items: [{ ...auditRow, policyProvenance: TaxPolicyProvenance.MIGRATION }],
      total: 1,
      skip: 0,
      take: 1,
    });
    expect(tx.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ id: 'audit-legacy-1' }]),
      }),
    }));
    expect(tx.taxPolicyVersion.findMany).toHaveBeenCalledWith({
      where: { provenance: TaxPolicyProvenance.MIGRATION },
      select: { id: true, provenance: true },
    });
  });

  it('loads approval receipts for the exact selected policy in both rows and total', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      taxPolicyApprovalRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.listTaxPolicyApprovalRequests('admin-1', {
      policyVersionId: 'policy-1',
      skip: '0',
      take: '25',
    })).resolves.toEqual({ items: [], total: 0, skip: 0, take: 25 });

    expect(tx.taxPolicyApprovalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { policyVersionId: 'policy-1' } }),
    );
    expect(tx.taxPolicyApprovalRequest.count).toHaveBeenCalledWith({
      where: { policyVersionId: 'policy-1' },
    });
  });

  it('counts the full lifecycle queue and selects the nearest scheduled policy independently of list pagination', async () => {
    const scheduled = { ...approvalReadyTaxPolicy(), id: 'scheduled-after-page-25' };
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue(scheduled),
        groupBy: vi.fn().mockResolvedValue([
          { lifecycleStatus: TaxPolicyLifecycleStatus.DRAFT, provenance: TaxPolicyProvenance.OPERATOR, _count: { _all: 31 } },
          { lifecycleStatus: TaxPolicyLifecycleStatus.PENDING_APPROVAL, provenance: TaxPolicyProvenance.OPERATOR, _count: { _all: 4 } },
          { lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED, provenance: TaxPolicyProvenance.OPERATOR, _count: { _all: 2 } },
          { lifecycleStatus: TaxPolicyLifecycleStatus.SUPERSEDED, provenance: TaxPolicyProvenance.SMOKE_TEST, _count: { _all: 145 } },
        ]),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.taxPolicyWorkspaceSummary(
      'admin-1',
      new Date('2026-08-14T00:00:00.000Z'),
    )).resolves.toMatchObject({
      drafts: { needsAuthor: 31, awaitingChecker: 4, approved: 0, scheduled: 2 },
      history: { production: 0, testOrLegacy: 145 },
      nextScheduled: expect.objectContaining({ id: 'scheduled-after-page-25' }),
    });
    expect(tx.taxPolicyVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
      where: expect.objectContaining({ lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED }),
    }));
  });

  it('keeps the exact integrity total when a requested page contains no rows', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ total: 13n }])
        .mockResolvedValueOnce([]),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.taxPolicyIntegrityRecords('admin-1', {
      issue: 'missing-tax-log',
      skip: '25',
      take: '25',
    }, new Date('2026-08-14T00:00:00.000Z'))).resolves.toMatchObject({
      issue: 'missing-tax-log',
      items: [],
      skip: 25,
      take: 25,
      total: 13,
    });
  });

  it('returns exact integrity evidence source, classification, and tax log amount', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ total: 1n }])
        .mockResolvedValueOnce([{
          bookingId: 'booking-1',
          createdAt: new Date('2026-08-10T01:00:00.000Z'),
          grossAmount: 500_000,
          id: 'earning-1',
          policyProvenance: TaxPolicyProvenance.OPERATOR,
          policyVersionId: 'policy-production-1',
          providerDisplayName: 'Lan Anh',
          providerProfileId: 'partner-1',
          taxLogWithholdingAmount: 20_000n,
          withholdingAmount: 25_000,
        }]),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.taxPolicyIntegrityRecords('admin-1', {
      from: '2026-08-01',
      issue: 'amount-mismatch',
      sort: 'newest',
      source: 'production',
      to: '2026-08-14',
    }, new Date('2026-08-14T12:00:00.000Z'))).resolves.toMatchObject({
      issue: 'amount-mismatch',
      items: [{
        classification: 'CURRENT_REGRESSION',
        evidenceSource: 'PRODUCTION',
        policyVersionId: 'policy-production-1',
        providerDisplayName: 'Lan Anh',
        taxLogWithholdingAmount: 20_000,
      }],
      sort: 'newest',
      source: 'production',
      total: 1,
    });
  });

  it('classifies missing approval evidence as applicability readiness without inventing provenance', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ total: 1n }])
        .mockResolvedValueOnce([{
          bookingId: 'booking-2',
          createdAt: new Date('2026-08-10T01:00:00.000Z'),
          grossAmount: 500_000,
          id: 'earning-2',
          policyProvenance: null,
          policyVersionId: null,
          providerDisplayName: 'Minh Chau',
          providerProfileId: 'partner-2',
          taxLogWithholdingAmount: 0n,
          withholdingAmount: 0,
        }]),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.taxPolicyIntegrityRecords('admin-1', {
      issue: 'no-approved-tax-profile',
      source: 'unknown',
    }, new Date('2026-08-14T12:00:00.000Z'))).resolves.toMatchObject({
      items: [{ classification: 'APPLICABILITY_READINESS', evidenceSource: 'UNKNOWN' }],
    });
  });

  it('uses the production withholding calculator for a read-only policy simulation', async () => {
    const policy = approvalReadyTaxPolicy();
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      taxPolicyVersion: { findUnique: vi.fn().mockResolvedValue(policy) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.simulateTaxPolicyVersion('admin-1', 'policy-governed-1', {
      grossAmount: '500000',
      serviceType: 'leg_massage',
    })).resolves.toMatchObject({
      amount: 25_000,
      currency: 'VND',
      policyVersionId: 'policy-governed-1',
      lines: [{ ruleId: 'rule-default-1', rateBps: 500 }],
    });
  });

  it('returns full-period integrity totals separately from the bounded evidence sample', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(verifiedTaxPolicyActor('admin-1')) },
      $queryRaw: vi.fn().mockResolvedValue([{
        total: 445n,
        healthy: 250n,
        amountMismatch: 2n,
        missingTaxLog: 3n,
        missingSnapshot: 4n,
        noActivePolicy: 9n,
        noApprovedTaxProfile: 177n,
        noMatchingRule: 5n,
      }]),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.taxPolicyIntegritySummary('admin-1', new Date('2026-08-12T00:00:00.000Z')))
      .resolves.toMatchObject({
        total: 445,
        recordIntegrity: { healthy: 250, amountMismatch: 2, missingTaxLog: 3, missingSnapshot: 4 },
        taxApplicability: { noActivePolicy: 9, noApprovedTaxProfile: 177, noMatchingRule: 5 },
      });
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
        ...taxPolicyLegalMetadata,
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
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-06-30T23:59:00.000Z',
        operatorReason: 'Correct the approved policy effective window.',
      }),
    ).rejects.toThrow('effectiveTo must be after effectiveFrom');

    expect(tx.taxPolicyVersion.updateMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

describe('ProviderOnboardingService tax policy immutability', () => {
  it('rejects direct ACTIVE policy creation before opening a transaction', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createTaxPolicyVersion('admin-1', {
        ...taxPolicyLegalMetadata,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        name: 'Vietnam withholding',
        operatorReason: 'Create a reviewed draft for the next settlement period.',
        status: TaxPolicyStatus.ACTIVE,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TAX_POLICY_DIRECT_ACTIVATION_FORBIDDEN' }),
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates only a DRAFT and writes its audit in the same transaction', async () => {
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
      lifecycleStatus: 'DRAFT',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const tx = {
      ...governedTaxPolicyAccess('admin-1'),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      taxPolicyVersion: {
        create: vi.fn().mockResolvedValue(policy),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createTaxPolicyVersion('admin-1', {
        ...taxPolicyLegalMetadata,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        name: 'Vietnam withholding',
        operatorReason: 'Create a reviewed draft for the next settlement period.',
      }),
    ).resolves.toEqual(policy);

    expect(tx.taxPolicyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TaxPolicyStatus.DRAFT,
          lifecycleStatus: TaxPolicyLifecycleStatus.DRAFT,
          provenance: TaxPolicyProvenance.OPERATOR,
        }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'tax_policy.draft_created',
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          operatorReason: 'Create a reviewed draft for the next settlement period.',
        }),
        target: 'tax_policy:policy-1',
      }),
    });
  });

  it('creates the optional fallback rule in the same transaction as the draft', async () => {
    const policy = {
      id: 'policy-atomic',
      name: 'Vietnam withholding',
      status: TaxPolicyStatus.DRAFT,
      lifecycleStatus: TaxPolicyLifecycleStatus.DRAFT,
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      effectiveTo: null,
      rules: [],
    };
    const rule = {
      id: 'rule-atomic',
      policyVersionId: policy.id,
      scope: TaxRuleScope.DEFAULT,
      serviceType: null,
      minGrossAmount: null,
      maxGrossAmount: null,
      rateBps: 500,
      fixedAmount: 0,
      active: true,
    };
    const tx = {
      ...governedTaxPolicyAccess('admin-1'),
      taxPolicyVersion: { create: vi.fn().mockResolvedValue(policy) },
      taxRule: { create: vi.fn().mockResolvedValue(rule) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-atomic' }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.createTaxPolicyVersion('admin-1', {
      ...taxPolicyLegalMetadata,
      name: policy.name,
      effectiveFrom: policy.effectiveFrom.toISOString(),
      defaultRateBps: 500,
      operatorReason: 'Create the reviewed policy and fallback rule atomically.',
    })).resolves.toMatchObject({ id: policy.id, rules: [rule] });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.taxRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        policyVersionId: policy.id,
        scope: TaxRuleScope.DEFAULT,
        rateBps: 500,
        fixedAmount: 0,
        active: true,
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects edits to an ACTIVE policy', async () => {
    const tx = {
      ...governedTaxPolicyAccess('admin-1'),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'policy-active',
          status: TaxPolicyStatus.ACTIVE,
          lifecycleStatus: 'ACTIVE',
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
          _count: { taxLogs: 0, bookingSettlementSnapshots: 0 },
        }),
        update: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.updateTaxPolicyVersion('admin-1', 'policy-active', {
        name: 'Attempted overwrite',
        operatorReason: 'Attempted correction to an active policy record.',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TAX_POLICY_IMMUTABLE' }) });

    expect(tx.taxPolicyVersion.update).not.toHaveBeenCalled();
  });

  it('rejects edits to a referenced DRAFT policy', async () => {
    const tx = {
      ...governedTaxPolicyAccess('admin-1'),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'policy-referenced',
          status: TaxPolicyStatus.DRAFT,
          lifecycleStatus: 'DRAFT',
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
          _count: { taxLogs: 1, bookingSettlementSnapshots: 0 },
        }),
        update: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.updateTaxPolicyVersion('admin-1', 'policy-referenced', {
        notes: 'Attempted rewrite',
        operatorReason: 'Attempted correction to a referenced policy record.',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TAX_POLICY_REFERENCED' }) });

    expect(tx.taxPolicyVersion.update).not.toHaveBeenCalled();
  });

  it('rejects rule creation for a non-draft policy', async () => {
    const tx = {
      ...governedTaxPolicyAccess('admin-1'),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'policy-active',
          status: TaxPolicyStatus.ACTIVE,
          lifecycleStatus: 'ACTIVE',
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
          _count: { taxLogs: 5, bookingSettlementSnapshots: 5 },
        }),
      },
      taxRule: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.createTaxRule('admin-1', 'policy-active', {
        operatorReason: 'Attempted rule insertion into an active policy.',
        rateBps: 500,
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TAX_POLICY_IMMUTABLE' }) });

    expect(tx.taxRule.create).not.toHaveBeenCalled();
  });
});

describe('ProviderOnboardingService tax policy maker-checker lifecycle', () => {
  it('requires explicit clean-source acknowledgement before submitting a draft derived from smoke data', async () => {
    const policy = {
      ...approvalReadyTaxPolicy(),
      supersedesPolicyVersion: {
        id: 'smoke-source-1',
        provenance: TaxPolicyProvenance.SMOKE_TEST,
      },
    };
    const tx = {
      ...governedTaxPolicyAccess('maker-1', false, [verifiedTaxPolicyActor('checker-1', true)]),
      taxPolicyVersion: { findUnique: vi.fn().mockResolvedValue(policy) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(service.submitTaxPolicyApprovalRequest('maker-1', policy.id, {
      idempotencyKey: 'tax-policy-clean-source-1',
      operatorReason: 'Submit the independently reconstructed production draft.',
    }, recentTaxPolicyAssurance())).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TAX_POLICY_CLEAN_SOURCE_ACKNOWLEDGEMENT_REQUIRED',
      }),
    });
  });

  it('persists the signed-in maker and submitted payload hash without a selected approver', async () => {
    const policy = approvalReadyTaxPolicy();
    let createdRequest: Record<string, unknown> | null = null;
    const tx = {
      ...governedTaxPolicyAccess('maker-1', false, [verifiedTaxPolicyActor('checker-1', true)]),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(policy),
        update: vi.fn().mockResolvedValue({ ...policy, lifecycleStatus: TaxPolicyLifecycleStatus.PENDING_APPROVAL }),
      },
      taxPolicyApprovalRequest: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          createdRequest = data;
          return {
            id: 'approval-1',
            ...data,
            status: TaxPolicyApprovalStatus.PENDING,
            requestedAt: new Date('2026-08-12T01:00:00.000Z'),
            decidedByAdminId: null,
            decisionReason: null,
            decidedAt: null,
            scheduledFor: null,
            activationJobId: null,
            activatedAt: null,
            failureCode: null,
            createdAt: new Date('2026-08-12T01:00:00.000Z'),
            updatedAt: new Date('2026-08-12T01:00:00.000Z'),
            policyVersion: policy,
            requestedByAdmin: verifiedTaxPolicyActor('maker-1'),
            decidedByAdmin: null,
          };
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-request' }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    const receipt = await service.submitTaxPolicyApprovalRequest('maker-1', policy.id, {
      idempotencyKey: 'tax-policy-request-1',
      operatorReason: 'Submit the verified legal schedule for independent approval.',
    }, recentTaxPolicyAssurance());

    expect(receipt).toMatchObject({
      policyVersionId: policy.id,
      status: TaxPolicyApprovalStatus.PENDING,
      maker: expect.objectContaining({ id: 'maker-1' }),
    });
    expect(createdRequest).toMatchObject({
      requestedByAdminId: 'maker-1',
      policyVersionId: policy.id,
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(createdRequest).not.toHaveProperty('approvalAdminId');
    expect(tx.taxPolicyVersion.update).toHaveBeenCalledWith({
      where: { id: policy.id },
      data: expect.objectContaining({
        lifecycleStatus: TaxPolicyLifecycleStatus.PENDING_APPROVAL,
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    });
  });

  it('forbids the maker from deciding the same approval request', async () => {
    const policy = {
      ...approvalReadyTaxPolicy(),
      lifecycleStatus: TaxPolicyLifecycleStatus.PENDING_APPROVAL,
      payloadHash: 'a'.repeat(64),
    };
    const request = {
      id: 'approval-1',
      policyVersionId: policy.id,
      requestedByAdminId: 'maker-1',
      decidedByAdminId: null,
      operatorReason: 'Submit the verified legal schedule for independent approval.',
      decisionReason: null,
      payloadHash: policy.payloadHash,
      status: TaxPolicyApprovalStatus.PENDING,
      requestedAt: new Date('2026-08-12T01:00:00.000Z'),
      decidedAt: null,
      scheduledFor: null,
      activationJobId: null,
      activatedAt: null,
      failureCode: null,
      createdAt: new Date('2026-08-12T01:00:00.000Z'),
      updatedAt: new Date('2026-08-12T01:00:00.000Z'),
      policyVersion: policy,
      requestedByAdmin: verifiedTaxPolicyActor('maker-1', true),
      decidedByAdmin: null,
    };
    const tx = {
      ...governedTaxPolicyAccess('maker-1', true),
      taxPolicyApprovalRequest: { findUnique: vi.fn().mockResolvedValue(request) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ProviderOnboardingService(prisma as never);

    await expect(
      service.decideTaxPolicyApprovalRequest('maker-1', request.id, {
        decision: 'APPROVE',
        decisionReason: 'I should not be able to approve my own policy request.',
      }, recentTaxPolicyAssurance()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MAKER_CHECKER_CONFLICT' }),
    });
  });

  it('schedules a future approved policy without changing the current ACTIVE policy', async () => {
    const policy = approvalReadyTaxPolicy();
    let payloadHash = '';
    const hashTx = {
      ...governedTaxPolicyAccess('maker-1', false, [verifiedTaxPolicyActor('checker-1', true)]),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(policy),
        update: vi.fn().mockImplementation(({ data }: { data: { payloadHash: string } }) => {
          payloadHash = data.payloadHash;
          return policy;
        }),
      },
      taxPolicyApprovalRequest: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: 'approval-future',
          ...data,
          status: TaxPolicyApprovalStatus.PENDING,
          requestedAt: new Date('2026-08-12T01:00:00.000Z'),
          decidedByAdminId: null,
          decisionReason: null,
          decidedAt: null,
          scheduledFor: null,
          activationJobId: null,
          activatedAt: null,
          failureCode: null,
          policyVersion: policy,
          requestedByAdmin: verifiedTaxPolicyActor('maker-1'),
          decidedByAdmin: null,
        })),
      },
      adminAuditLog: { create: vi.fn() },
    };
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };
    const submitPrisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof hashTx) => Promise<unknown>) =>
        callback(hashTx),
      ),
    };
    const submitService = new ProviderOnboardingService(submitPrisma as never);
    await submitService.submitTaxPolicyApprovalRequest('maker-1', policy.id, {
      idempotencyKey: 'tax-policy-future-request',
      operatorReason: 'Submit the future legal schedule for independent approval.',
    }, recentTaxPolicyAssurance());
    policy.payloadHash = payloadHash;
    policy.lifecycleStatus = TaxPolicyLifecycleStatus.PENDING_APPROVAL;

    const request = {
      id: 'approval-future',
      policyVersionId: policy.id,
      requestedByAdminId: 'maker-1',
      decidedByAdminId: null,
      operatorReason: 'Submit the future legal schedule for independent approval.',
      decisionReason: null,
      payloadHash,
      status: TaxPolicyApprovalStatus.PENDING,
      requestedAt: new Date('2026-08-12T01:00:00.000Z'),
      decidedAt: null,
      scheduledFor: null,
      activationJobId: null,
      activatedAt: null,
      failureCode: null,
      policyVersion: policy,
      requestedByAdmin: verifiedTaxPolicyActor('maker-1'),
      decidedByAdmin: null,
    };
    const approved = {
      ...request,
      status: TaxPolicyApprovalStatus.APPROVED,
      decidedByAdminId: 'checker-1',
      decisionReason: 'Legal source and effective window independently verified.',
      decidedAt: new Date(),
      scheduledFor: policy.effectiveFrom,
      decidedByAdmin: verifiedTaxPolicyActor('checker-1', true),
    };
    const decisionTx = {
      ...governedTaxPolicyAccess('checker-1', true),
      taxPolicyApprovalRequest: {
        findUnique: vi.fn().mockResolvedValue(request),
        update: vi.fn().mockResolvedValue(approved),
      },
      taxPolicyVersion: {
        update: vi.fn().mockResolvedValue({ ...policy, lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED }),
        updateMany: vi.fn(),
      },
      adminAuditLog: { create: vi.fn() },
    };
    const decisionPrisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof decisionTx) => Promise<unknown>) =>
        callback(decisionTx),
      ),
    };
    const decisionService = new ProviderOnboardingService(
      decisionPrisma as never,
      undefined,
      queue as never,
    );

    await expect(
      decisionService.decideTaxPolicyApprovalRequest('checker-1', request.id, {
        decision: 'APPROVE',
        decisionReason: 'Legal source and effective window independently verified.',
      }, recentTaxPolicyAssurance()),
    ).resolves.toMatchObject({ status: TaxPolicyApprovalStatus.APPROVED });

    expect(decisionTx.taxPolicyVersion.updateMany).not.toHaveBeenCalled();
    expect(decisionTx.taxPolicyVersion.update).toHaveBeenCalledWith({
      where: { id: policy.id },
      data: expect.objectContaining({ lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'activate-tax-policy',
      { policyVersionId: policy.id, approvalRequestId: request.id },
      expect.objectContaining({ delay: expect.any(Number) }),
    );

    const activationPolicy = {
      ...policy,
      lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED,
      payloadHash,
    };
    const activationRequest = {
      ...approved,
      policyVersion: activationPolicy,
    };
    const activationTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      taxPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(activationPolicy),
        findMany: vi.fn().mockResolvedValue([{ id: 'policy-current-active' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...activationPolicy,
          status: TaxPolicyStatus.ACTIVE,
          lifecycleStatus: TaxPolicyLifecycleStatus.ACTIVE,
        }),
      },
      taxPolicyApprovalRequest: {
        findUnique: vi.fn().mockResolvedValue(activationRequest),
        update: vi.fn().mockResolvedValue({
          ...activationRequest,
          status: TaxPolicyApprovalStatus.ACTIVATED,
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-activation' }) },
    };
    const activationPrisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof activationTx) => Promise<unknown>) =>
        callback(activationTx),
      ),
    };
    const activationService = new ProviderOnboardingService(activationPrisma as never);

    await expect(
      activationService.activateTaxPolicyVersion(
        policy.id,
        request.id,
        new Date('2026-09-01T00:01:00.000Z'),
      ),
    ).resolves.toMatchObject({
      activated: true,
      previousActiveId: 'policy-current-active',
      replayed: false,
    });
    expect(activationTx.taxPolicyVersion.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['policy-current-active'] } },
      data: expect.objectContaining({
        status: TaxPolicyStatus.INACTIVE,
        lifecycleStatus: TaxPolicyLifecycleStatus.SUPERSEDED,
      }),
    });
    expect(activationTx.taxPolicyVersion.update).toHaveBeenCalledWith({
      where: { id: policy.id },
      data: expect.objectContaining({
        status: TaxPolicyStatus.ACTIVE,
        lifecycleStatus: TaxPolicyLifecycleStatus.ACTIVE,
        supersedesPolicyVersionId: 'policy-current-active',
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
    const attemptedSelfApproval = {
      bankName: ' Vietcombank ',
      accountNumber: '12345 6789',
      accountHolderName: ' Linh Tran ',
      status: ProviderBankAccountStatus.APPROVED,
    };

    await expect(
      service.createBankAccount('provider-user-1', attemptedSelfApproval),
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

  it('forces a Partner tax profile submission back to pending review', async () => {
    const providerProfile = {
      id: 'provider-1',
      userId: 'provider-user-1',
      bankAccounts: [],
      verification: null,
      kyc: null,
      documents: [],
      taxProfile: { id: 'tax-1', status: ProviderTaxProfileStatus.APPROVED },
      agreements: [],
      verificationLogs: [],
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(providerProfile) },
      providerTaxProfile: {
        upsert: vi.fn().mockResolvedValue({
          id: 'tax-1',
          taxCodeLast4: '5678',
          status: ProviderTaxProfileStatus.PENDING_REVIEW,
        }),
      },
      providerVerificationLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
    };
    const service = new ProviderOnboardingService(prisma as never);
    const attemptedSelfApproval = {
      taxCode: '1234 5678',
      legalName: 'Linh Tran',
      registeredAddress: 'Ho Chi Minh City',
      status: ProviderTaxProfileStatus.APPROVED,
    };

    await service.upsertTaxProfile('provider-user-1', attemptedSelfApproval);

    expect(prisma.providerTaxProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: ProviderTaxProfileStatus.PENDING_REVIEW }),
        create: expect.objectContaining({ status: ProviderTaxProfileStatus.PENDING_REVIEW }),
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
