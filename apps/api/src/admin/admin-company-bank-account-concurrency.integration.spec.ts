import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  CompanyBankAccountDataScope,
  CompanyBankAccountStatus,
  FilePurpose,
  FileUploadStatus,
  FileVisibility,
  PrismaClient,
  Role,
} from '@prisma/client';

import { disposableIntegrationDatabaseTarget } from '../common/disposable-integration-database';
import { AdminService } from './admin.service';
import { FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION } from './finance-approver-policy';

const integrationEnabled = process.env.RUN_COMPANY_BANK_ACCOUNT_DB_INTEGRATION === '1';
const integrationTarget = integrationEnabled
  ? disposableIntegrationDatabaseTarget(
      process.env.DATABASE_URL,
      process.env.INTEGRATION_DATABASE_ALLOWLIST,
    )
  : null;
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('Company bank account PostgreSQL concurrency', () => {
  const prisma = new PrismaClient({
    ...(integrationTarget ? { datasources: { db: { url: integrationTarget.databaseUrl } } } : {}),
  });
  const runId = `company-bank-concurrency-${Date.now()}`;
  const actorIds = [
    `${runId}-maker-a`,
    `${runId}-maker-b`,
    `${runId}-checker`,
  ];
  const last4 = String(Date.now()).slice(-4);
  const evidenceIntegrity = new Map<
    string,
    { contentSha256: string; ownerUserId: string; uploadedAt: Date }
  >();
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      companyBankAccountEvidenceIntegrity: async (fileAssetId: string) => {
        const evidence = evidenceIntegrity.get(fileAssetId);
        if (!evidence) throw new Error(`Missing disposable evidence ${fileAssetId}`);
        return {
          ...evidence,
          contentType: 'application/pdf',
          fileAssetId,
          sizeBytes: 1024,
        };
      },
    } as never,
  );

  beforeAll(async () => {
    await prisma.user.createMany({
      data: actorIds.map((id, index) => ({
        id,
        fullName: `Company bank concurrency actor ${index + 1}`,
        phone: `admin:${id}`,
        roles: index === 2 ? [Role.ADMIN, Role.FINANCE_APPROVER] : [Role.ADMIN],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      })),
      skipDuplicates: true,
    });
    await prisma.adminOperatorCredential.upsert({
      where: { userId: actorIds[2] },
      create: {
        userId: actorIds[2],
        email: `${runId}.checker@hands.test`,
        passwordHash: 'integration-only-hash',
        passwordSalt: 'integration-only-salt',
        setupCompletedAt: new Date(),
        mfaState: 'VERIFIED',
      },
      update: {
        disabledAt: null,
        lockedUntil: null,
        setupCompletedAt: new Date(),
        mfaState: 'VERIFIED',
      },
    });
    await Promise.all(
      actorIds.map((userId, index) => {
        const categories =
          index === 2
            ? [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION]
            : [
                AdminOperatorPermissionCategory.SYSTEM_POLICY,
                AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
              ];
        return prisma.adminOperatorPermission.upsert({
          where: { userId },
          create: { userId, categories },
          update: { categories: { set: categories } },
        });
      }),
    );
    const attestationEffectiveAt = new Date();
    await prisma.adminAuditLog.create({
      data: {
        actorId: actorIds[0],
        action: FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION,
        target: `finance_approver_attestation:${actorIds[2]}:${runId}`,
        metadata: {
          attestationRequestEventId: `${runId}:attestation-request`,
          attestorId: actorIds[1],
          effectiveAt: attestationEffectiveAt.toISOString(),
          expiresAt: new Date(
            attestationEffectiveAt.getTime() + 24 * 60 * 60_000,
          ).toISOString(),
          independentCheckerId: actorIds[0],
          permissionVersion: 1,
          sourceReference: `disposable-integration:${runId}`,
          targetSnapshot: {
            permission: {
              categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
              version: 1,
            },
            roles: [Role.ADMIN, Role.FINANCE_APPROVER],
          },
          targetUserId: actorIds[2],
        },
      },
    });
  });

  afterAll(async () => {
    const accounts = await prisma.companyBankAccount.findMany({
      where: { name: { startsWith: runId } },
      select: { id: true },
    });
    const evidences = await prisma.companyBankAccountEvidence.findMany({
      where: { bankAccountId: { in: accounts.map((account) => account.id) } },
      select: { fileAssetId: true },
    });
    await prisma.companyBankAccountEvidence.deleteMany({
      where: { bankAccountId: { in: accounts.map((account) => account.id) } },
    });
    await prisma.fileAsset.deleteMany({
      where: { id: { in: evidences.map((evidence) => evidence.fileAssetId) } },
    });
    await prisma.companyBankAccount.deleteMany({ where: { id: { in: accounts.map((account) => account.id) } } });
    await prisma.$disconnect();
  });

  it('serializes different actors and idempotency keys for the same controlled identity', async () => {
    const request = (actorId: string, suffix: string) => service.createCompanyBankAccount(actorId, {
      accountNumberLast4: last4,
      bankCode: 'VCB',
      bankName: 'VCB',
      currency: 'VND',
      idempotencyKey: `${runId}:${suffix}`,
      name: `${runId} ${suffix}`,
      operatorReason: `Concurrent duplicate review evidence for ${suffix}`,
    });

    const outcomes = await Promise.allSettled([
      request(actorIds[0], 'request-a'),
      request(actorIds[1], 'request-b'),
    ]);
    const diagnostics = outcomes.map((outcome) => outcome.status === 'fulfilled'
      ? { status: outcome.status, id: outcome.value.id }
      : {
          status: outcome.status,
          code: errorCode(outcome.reason),
          message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          response: typeof outcome.reason?.getResponse === 'function' ? outcome.reason.getResponse() : null,
        });

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled'), JSON.stringify(diagnostics)).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' ? errorCode(rejected.reason) : null).toBe(
      'COMPANY_BANK_ACCOUNT_POTENTIAL_DUPLICATE',
    );
    await expect(
      prisma.companyBankAccount.count({ where: { name: { startsWith: runId } } }),
    ).resolves.toBe(1);
    const account = await prisma.companyBankAccount.findFirstOrThrow({
      where: { name: { startsWith: runId } },
      select: { id: true },
    });
    await expect(prisma.adminAuditLog.count({
      where: {
        action: 'company_bank_account.approval_requested',
        target: `company_bank_account:${account.id}`,
      },
    })).resolves.toBe(1);
  }, 30_000);

  it('serializes concurrent exact replay to one account and one audit request', async () => {
    const replayLast4 = String((Number(last4) + 1111) % 10_000).padStart(4, '0');
    const input = {
      accountNumberLast4: replayLast4,
      bankCode: 'VCB' as const,
      bankName: 'VCB',
      currency: 'VND',
      idempotencyKey: `${runId}:exact-replay`,
      name: `${runId} exact replay`,
      operatorReason: 'Concurrent exact request replay evidence',
    };

    const outcomes = await Promise.all([
      service.createCompanyBankAccount(actorIds[0], input),
      service.createCompanyBankAccount(actorIds[0], input),
    ]);

    expect(outcomes[0].id).toBe(outcomes[1].id);
    await expect(
      prisma.companyBankAccount.count({ where: { name: input.name } }),
    ).resolves.toBe(1);
    await expect(
      prisma.adminAuditLog.count({
        where: {
          action: 'company_bank_account.approval_requested',
          actorId: actorIds[0],
          target: `company_bank_account:${outcomes[0].id}`,
        },
      }),
    ).resolves.toBe(1);
  }, 30_000);

  it('keeps classification, statement verification, and activation as separate checker decisions', async () => {
    const lifecycleLast4 = String((Number(last4) + 2222) % 10_000).padStart(4, '0');
    const before = await Promise.all([
      prisma.companyBankTransaction.count(),
      prisma.providerPayoutBatch.count(),
      prisma.refund.count(),
      prisma.bookingSettlementSnapshot.count(),
    ]);
    const created = await service.createCompanyBankAccount(actorIds[0], {
      accountNumberLast4: lifecycleLast4,
      bankCode: 'VCB',
      bankName: 'VCB',
      currency: 'VND',
      direction: 'BOTH',
      idempotencyKey: `${runId}:lifecycle-create`,
      isPrimary: true,
      legalOwnerName: 'HANDS Vietnam Company Limited',
      name: `${runId} lifecycle`,
      operatorReason: 'Create isolated lifecycle account evidence',
      purpose: 'RECONCILIATION',
    });
    const createRequestId = pendingRequestId(created.metadata);
    const createdDecision = await service.decideCompanyBankAccountChange(
      actorIds[2],
      created.id,
      {
        decision: 'APPROVE',
        operatorReason: 'Approve isolated account shell creation',
        requestId: createRequestId,
      },
    );
    expect(createdDecision).toMatchObject({
      dataScope: CompanyBankAccountDataScope.UNKNOWN,
      status: CompanyBankAccountStatus.INACTIVE,
    });

    const ownershipFile = await prisma.fileAsset.create({
      data: {
        contentType: 'application/pdf',
        key: `private/finance-evidence/${runId}-ownership.pdf`,
        ownerUserId: actorIds[0],
        purpose: FilePurpose.FINANCE_EVIDENCE,
        sizeBytes: 1024,
        uploadedAt: new Date(),
        uploadStatus: FileUploadStatus.UPLOADED,
        visibility: FileVisibility.PRIVATE,
      },
    });
    evidenceIntegrity.set(ownershipFile.id, {
      contentSha256: 'a'.repeat(64),
      ownerUserId: actorIds[0],
      uploadedAt: ownershipFile.uploadedAt!,
    });
    const classificationRequest = await service.createCompanyBankAccountEvidenceReview(
      actorIds[0],
      created.id,
      {
        expectedAccountUpdatedAt: createdDecision.updatedAt.toISOString(),
        fileAssetId: ownershipFile.id,
        idempotencyKey: `${runId}:classification`,
        intent: 'CLASSIFY_PRODUCTION',
        operatorReason: 'Submit verified company ownership evidence',
      },
    );
    const classified = await service.decideCompanyBankAccountChange(actorIds[2], created.id, {
      decision: 'APPROVE',
      operatorReason: 'Confirm company ownership evidence and scope',
      requestId: pendingRequestId(classificationRequest.metadata),
    });
    expect(classified).toMatchObject({
      dataScope: CompanyBankAccountDataScope.PRODUCTION,
      status: CompanyBankAccountStatus.INACTIVE,
    });

    const statementFile = await prisma.fileAsset.create({
      data: {
        contentType: 'application/pdf',
        key: `private/finance-evidence/${runId}-statement.pdf`,
        ownerUserId: actorIds[0],
        purpose: FilePurpose.FINANCE_EVIDENCE,
        sizeBytes: 1024,
        uploadedAt: new Date(),
        uploadStatus: FileUploadStatus.UPLOADED,
        visibility: FileVisibility.PRIVATE,
      },
    });
    evidenceIntegrity.set(statementFile.id, {
      contentSha256: 'b'.repeat(64),
      ownerUserId: actorIds[0],
      uploadedAt: statementFile.uploadedAt!,
    });
    const statementRequest = await service.createCompanyBankAccountEvidenceReview(
      actorIds[0],
      created.id,
      {
        expectedAccountUpdatedAt: classified.updatedAt.toISOString(),
        fileAssetId: statementFile.id,
        idempotencyKey: `${runId}:statement`,
        intent: 'VERIFY_STATEMENT',
        operatorReason: 'Submit non-operational statement evidence',
      },
    );
    const verified = await service.decideCompanyBankAccountChange(actorIds[2], created.id, {
      decision: 'APPROVE',
      operatorReason: 'Confirm statement identity without importing transactions',
      requestId: pendingRequestId(statementRequest.metadata),
    });
    expect(verified).toMatchObject({ status: CompanyBankAccountStatus.INACTIVE });

    const activationRequest = await service.updateCompanyBankAccount(actorIds[0], created.id, {
      idempotencyKey: `${runId}:activation`,
      operatorReason: 'Activate after ownership and statement verification',
      status: CompanyBankAccountStatus.ACTIVE,
    });
    const activated = await service.decideCompanyBankAccountChange(actorIds[2], created.id, {
      decision: 'APPROVE',
      operatorReason: 'Approve verified production account activation',
      requestId: pendingRequestId(activationRequest.metadata),
    });
    expect(activated).toMatchObject({
      dataScope: CompanyBankAccountDataScope.PRODUCTION,
      status: CompanyBankAccountStatus.ACTIVE,
    });

    const replacementProfile = {
      bankCode: 'VCB',
      direction: 'BOTH',
      evidenceObjectId: 'disposable-replacement-ownership',
      isPrimary: false,
      legalOwnerName: 'HANDS Vietnam Company Limited',
      purpose: 'RECONCILIATION',
      statementImportTestedAt: new Date().toISOString(),
      verificationMethod: 'DISPOSABLE_VERIFIED_EVIDENCE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      verifiedByAdminId: actorIds[2],
    };
    const replacement = await prisma.companyBankAccount.create({
      data: {
        accountNumberLast4: String((Number(last4) + 3333) % 10_000).padStart(4, '0'),
        accountNumberMasked: `•••• ${String((Number(last4) + 3333) % 10_000).padStart(4, '0')}`,
        bankName: 'VCB',
        currency: 'VND',
        dataScope: CompanyBankAccountDataScope.PRODUCTION,
        metadata: { operationalProfile: replacementProfile },
        name: `${runId} archive replacement`,
        status: CompanyBankAccountStatus.ACTIVE,
      },
    });
    const archiveRequest = await service.updateCompanyBankAccount(actorIds[0], activated.id, {
      idempotencyKey: `${runId}:archive-primary`,
      operatorReason: 'Archive after zero-reference preflight and verified replacement review',
      replacementAccountId: replacement.id,
      status: CompanyBankAccountStatus.INACTIVE,
    });
    const archived = await service.decideCompanyBankAccountChange(actorIds[2], activated.id, {
      decision: 'APPROVE',
      operatorReason: 'Approve atomic primary replacement after source review',
      requestId: pendingRequestId(archiveRequest.metadata),
    });
    const promotedReplacement = await prisma.companyBankAccount.findUniqueOrThrow({
      where: { id: replacement.id },
    });
    expect(archived).toMatchObject({
      accountNumberLast4: lifecycleLast4,
      bankName: 'VCB',
      status: CompanyBankAccountStatus.INACTIVE,
    });
    expect(operationalProfile(archived.metadata)).toMatchObject({ isPrimary: false });
    expect(archived.metadata).toMatchObject({ replacedByAccountId: replacement.id });
    expect(promotedReplacement).toMatchObject({
      accountNumberLast4: replacement.accountNumberLast4,
      bankName: replacement.bankName,
      status: CompanyBankAccountStatus.ACTIVE,
    });
    expect(operationalProfile(promotedReplacement.metadata)).toMatchObject({ isPrimary: true });
    expect(promotedReplacement.metadata).toMatchObject({ replacedPrimaryAccountId: activated.id });

    const rollbackCurrent = await prisma.companyBankAccount.create({
      data: {
        accountNumberLast4: String((Number(last4) + 4444) % 10_000).padStart(4, '0'),
        accountNumberMasked: `•••• ${String((Number(last4) + 4444) % 10_000).padStart(4, '0')}`,
        bankName: 'VCB',
        currency: 'VND',
        dataScope: CompanyBankAccountDataScope.PRODUCTION,
        metadata: { operationalProfile: { ...replacementProfile, isPrimary: true } },
        name: `${runId} rollback current`,
        status: CompanyBankAccountStatus.ACTIVE,
      },
    });
    const rollbackReplacement = await prisma.companyBankAccount.create({
      data: {
        accountNumberLast4: String((Number(last4) + 5555) % 10_000).padStart(4, '0'),
        accountNumberMasked: `•••• ${String((Number(last4) + 5555) % 10_000).padStart(4, '0')}`,
        bankName: 'VCB',
        currency: 'VND',
        dataScope: CompanyBankAccountDataScope.PRODUCTION,
        metadata: { operationalProfile: replacementProfile },
        name: `${runId} rollback replacement`,
        status: CompanyBankAccountStatus.ACTIVE,
      },
    });
    const rollbackRequest = await service.updateCompanyBankAccount(actorIds[0], rollbackCurrent.id, {
      idempotencyKey: `${runId}:archive-rollback`,
      operatorReason: 'Prepare disposable rollback proof for primary replacement',
      replacementAccountId: rollbackReplacement.id,
      status: CompanyBankAccountStatus.INACTIVE,
    });
    const failingPrisma = prismaWithFailingAuditCreate(prisma);
    const failingService = new AdminService(
      failingPrisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      failingService.decideCompanyBankAccountChange(actorIds[2], rollbackCurrent.id, {
        decision: 'APPROVE',
        operatorReason: 'Force rollback after both account writes are staged',
        requestId: pendingRequestId(rollbackRequest.metadata),
      }),
    ).rejects.toThrow('DISPOSABLE_AUDIT_FAILURE');
    const [rollbackCurrentAfter, rollbackReplacementAfter] = await Promise.all([
      prisma.companyBankAccount.findUniqueOrThrow({ where: { id: rollbackCurrent.id } }),
      prisma.companyBankAccount.findUniqueOrThrow({ where: { id: rollbackReplacement.id } }),
    ]);
    expect(rollbackCurrentAfter.status).toBe(CompanyBankAccountStatus.ACTIVE);
    expect(operationalProfile(rollbackCurrentAfter.metadata)).toMatchObject({ isPrimary: true });
    expect(pendingRequestId(rollbackCurrentAfter.metadata)).toBe(pendingRequestId(rollbackRequest.metadata));
    expect(rollbackReplacementAfter.status).toBe(CompanyBankAccountStatus.ACTIVE);
    expect(operationalProfile(rollbackReplacementAfter.metadata)).toMatchObject({ isPrimary: false });

    await expect(
      Promise.all([
        prisma.companyBankTransaction.count(),
        prisma.providerPayoutBatch.count(),
        prisma.refund.count(),
        prisma.bookingSettlementSnapshot.count(),
      ]),
    ).resolves.toEqual(before);
  }, 60_000);
});

function pendingRequestId(metadata: unknown) {
  const requestId = (metadata as { pendingApproval?: { requestId?: unknown } } | null)
    ?.pendingApproval?.requestId;
  if (typeof requestId !== 'string') throw new Error('Disposable pending approval request is missing');
  return requestId;
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'getResponse' in error) {
    const response = (error as { getResponse: () => unknown }).getResponse();
    if (response && typeof response === 'object' && 'code' in response) return response.code;
  }
  return null;
}

function operationalProfile(metadata: unknown) {
  const profile = (metadata as { operationalProfile?: unknown } | null)?.operationalProfile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Disposable account operational profile is missing');
  }
  return profile;
}

function prismaWithFailingAuditCreate(prisma: PrismaClient) {
  return new Proxy(prisma, {
    get(target, property) {
      if (property === '$transaction') {
        return (
          callback: (transaction: unknown) => unknown,
          options?: { isolationLevel?: unknown },
        ) => target.$transaction(
          async (transaction) => callback(new Proxy(transaction, {
            get(transactionTarget, transactionProperty) {
              const value = Reflect.get(transactionTarget, transactionProperty);
              if (transactionProperty !== 'adminAuditLog') {
                return typeof value === 'function' ? value.bind(transactionTarget) : value;
              }
              return new Proxy(value, {
                get(delegateTarget, delegateProperty) {
                  if (delegateProperty === 'create') {
                    return () => Promise.reject(new Error('DISPOSABLE_AUDIT_FAILURE'));
                  }
                  const delegateValue = Reflect.get(delegateTarget, delegateProperty);
                  return typeof delegateValue === 'function'
                    ? delegateValue.bind(delegateTarget)
                    : delegateValue;
                },
              });
            },
          }) as never),
          options as never,
        );
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
