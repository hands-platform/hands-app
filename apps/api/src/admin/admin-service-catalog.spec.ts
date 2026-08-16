import { ConflictException } from '@nestjs/common';
import { ServiceCatalogProvenance, ServicePublicationStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService service catalog group commands', () => {
  it('loads bounded group impact only when the editor requests it', async () => {
    const prisma = {
      massageService: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'service-60', basePrice: 500000 },
          { id: 'service-90', basePrice: 600000 },
        ]),
      },
      providerService: {
        findMany: vi.fn().mockResolvedValue([
          { providerProfileId: 'partner-1', price: 500000, service: { basePrice: 500000 } },
          { providerProfileId: 'partner-1', price: 650000, service: { basePrice: 600000 } },
          { providerProfileId: 'partner-2', price: 600000, service: { basePrice: 600000 } },
        ]),
      },
      bookingService: { count: vi.fn().mockResolvedValue(3) },
    };
    const service = createAdminService(prisma);

    await expect(service.serviceCatalogGroupImpact('aroma_massage')).resolves.toEqual({
      groupKey: 'aroma_massage',
      activePartnerCount: 2,
      customPricePartnerCount: 1,
      openBookingLineCount: 3,
    });
  });

  it('saves an incomplete draft without changing app-visible service or payout rows', async () => {
    const tx = catalogTransaction();
    const service = adminServiceWithTransaction(tx);

    await expect(
      service.saveServiceCatalogGroup('admin-1', 'aroma_massage',
        catalogCommand({ intent: 'SAVE_DRAFT', expectedVersion: 0 }),
      ),
    ).resolves.toMatchObject({ draft: { serviceGroupKey: 'aroma_massage', version: 1 } });

    expect(tx.serviceCatalogDraft.upsert).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.serviceCatalogDraft.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.massageService.upsert).not.toHaveBeenCalled();
    expect(tx.servicePayoutRule.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'service_catalog.draft_saved' }),
    });
  });

  it('publishes all duration prices and immutable payout rule versions in one transaction', async () => {
    const published = [60, 90, 120].map((durationMin) => publishedService(durationMin));
    const tx = catalogTransaction({
      massageServiceFindMany: [[], published, published],
      massageServiceUpsert: [
        { id: 'service-60', basePrice: 500000 },
        { id: 'service-90', basePrice: 600000 },
        { id: 'service-120', basePrice: 700000 },
      ],
    });
    const transaction = vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = createAdminService({ $transaction: transaction });

    await service.saveServiceCatalogGroup(
      'admin-1',
      'aroma_massage',
      catalogCommand({ intent: 'PUBLISH', expectedVersion: 0 }),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.massageService.upsert).toHaveBeenCalledTimes(3);
    expect(tx.servicePayoutRule.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.servicePayoutRule.create).toHaveBeenCalledTimes(3);
    expect(tx.servicePayoutRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        active: true,
        customerPrice: 500000,
        providerPayoutAmount: 300000,
        serviceId: 'service-60',
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'service_catalog.published' }),
    });
  });

  it('rejects a stale editor version before writing a draft or service row', async () => {
    const tx = catalogTransaction({
      currentDraft: draftRecord({ version: 4 }),
    });
    const service = adminServiceWithTransaction(tx);

    await expect(
      service.saveServiceCatalogGroup(
        'admin-1',
        'aroma_massage',
        catalogCommand({ intent: 'SAVE_DRAFT', expectedVersion: 3 }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.serviceCatalogDraft.upsert).not.toHaveBeenCalled();
    expect(tx.massageService.upsert).not.toHaveBeenCalled();
  });

  it('returns a field-level key collision for a new drawer using an existing group key', async () => {
    const tx = catalogTransaction({
      massageServiceFindMany: [[publishedService(60)]],
    });
    const service = adminServiceWithTransaction(tx);

    const error = await service
      .saveServiceCatalogGroup(
        'admin-1',
        'aroma_massage',
        catalogCommand({ intent: 'SAVE_DRAFT', expectedVersion: 0 }),
      )
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'SERVICE_CATALOG_GROUP_KEY_EXISTS',
      fieldErrors: { serviceGroupKey: 'This service key is already in use.' },
    });
  });

  it('replays the same request ID without repeating writes and rejects a changed payload', async () => {
    const command = catalogCommand({ intent: 'SAVE_DRAFT', expectedVersion: 0 });
    const firstTx = catalogTransaction();
    const firstService = adminServiceWithTransaction(firstTx);

    // Capture the deterministic hash from a normal write, then use it for the replay fixture.
    const writeTx = catalogTransaction();
    const writeService = adminServiceWithTransaction(writeTx);
    await writeService.saveServiceCatalogGroup('admin-1', 'aroma_massage', command);
    const savedHash = writeTx.serviceCatalogDraft.upsert.mock.calls[0]?.[0]?.create?.lastMutationHash;
    firstTx.serviceCatalogDraft.findUnique.mockReset().mockResolvedValue(
      draftRecord({ lastMutationKey: command.requestId, lastMutationHash: savedHash }),
    );

    await expect(
      firstService.saveServiceCatalogGroup('admin-1', 'aroma_massage', command),
    ).resolves.toMatchObject({ draft: { lastMutationKey: command.requestId } });
    expect(firstTx.serviceCatalogDraft.upsert).not.toHaveBeenCalled();
    expect(firstTx.adminAuditLog.create).not.toHaveBeenCalled();

    await expect(
      firstService.saveServiceCatalogGroup('admin-1', 'aroma_massage', {
        ...command,
        reason: 'A different payload using the same request identifier',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects legacy service and payout mutations for published operational catalog rows', async () => {
    const published = publishedService(60);
    const updateService = createAdminService({
      massageService: { findUniqueOrThrow: vi.fn().mockResolvedValue(published) },
    });
    const bulkPayout = createAdminService({
      massageService: { findUniqueOrThrow: vi.fn().mockResolvedValue(published) },
    });
    const payoutRule = createAdminService({
      $transaction: vi.fn(async (callback) =>
        callback({
          massageService: { findUniqueOrThrow: vi.fn().mockResolvedValue(published) },
        }),
      ),
    });
    const updatePayoutRule = createAdminService({
      $transaction: vi.fn(async (callback) =>
        callback({
          servicePayoutRule: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              id: 'rule-1',
              serviceId: published.id,
              service: published,
            }),
          },
        }),
      ),
    });

    await expectLegacyCatalogConflict(
      updateService.updateService('admin-1', published.id, { name: 'Changed name' }),
    );
    await expectLegacyCatalogConflict(
      bulkPayout.bulkUpsertServicePayoutRules('admin-1', published.id, {
        rules: [{ customerPrice: 500000, providerPayoutAmount: 300000 }],
      }),
    );
    await expectLegacyCatalogConflict(
      payoutRule.upsertServicePayoutRule('admin-1', published.id, {
        customerPrice: 500000,
        providerPayoutAmount: 300000,
      }),
    );
    await expectLegacyCatalogConflict(
      updatePayoutRule.updateServicePayoutRule('admin-1', 'rule-1', {
        customerPrice: 500000,
      }),
    );
  });

  it('keeps the legacy mutation path available for explicit smoke catalog rows', async () => {
    const smoke = {
      ...publishedService(60),
      provenance: ServiceCatalogProvenance.SMOKE_TEST,
    };
    const tx = {
      massageService: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ ...smoke, name: 'Smoke updated' }),
      },
      providerService: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = createAdminService({
      massageService: { findUniqueOrThrow: vi.fn().mockResolvedValue(smoke) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    });

    await expect(
      service.updateService('admin-1', smoke.id, { name: 'Smoke updated' }),
    ).resolves.toMatchObject({ name: 'Smoke updated' });
  });

  it('derives health from the same exact public payout projection', async () => {
    const live = {
      ...publishedService(60),
      payoutRules: [
        { ...payoutRule(500000, 300000), active: true },
        { ...payoutRule(400000, 250000), active: false },
      ],
    };
    const blocked = {
      ...publishedService(90),
      basePrice: 600000,
      payoutRules: [{ ...payoutRule(600000, 650000), active: true }],
    };
    const service = createAdminService({
      massageService: { findMany: vi.fn().mockResolvedValue([live, blocked]) },
      serviceCatalogDraft: {
        findMany: vi.fn().mockResolvedValue([
          { serviceGroupKey: 'aroma_massage', version: 2 },
          { serviceGroupKey: 'new_draft', version: 1 },
        ]),
      },
    });

    await expect(service.serviceCatalogHealth()).resolves.toMatchObject({
      status: 'degraded',
      liveGroupCount: 1,
      liveOptionCount: 1,
      blockedOptionCount: 1,
      anomalyCount: 1,
      liveEnViReadyGroupCount: 1,
      currentPayoutRuleCount: 1,
      historicalPayoutRuleCount: 2,
      workingDraftCount: 2,
      lastPublishedById: 'admin-1',
      auditTarget: 'service_group:aroma_massage',
    });
  });
});

async function expectLegacyCatalogConflict(promise: Promise<unknown>) {
  const error = await promise.catch((caught) => caught);
  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getResponse()).toMatchObject({
    code: 'SERVICE_CATALOG_GROUP_COMMAND_REQUIRED',
  });
}

function createAdminService(prisma: Record<string, unknown>) {
  return new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function adminServiceWithTransaction(tx: ReturnType<typeof catalogTransaction>) {
  return createAdminService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  });
}

function catalogTransaction(options: {
  currentDraft?: ReturnType<typeof draftRecord> | null;
  replayDraft?: ReturnType<typeof draftRecord> | null;
  massageServiceFindMany?: unknown[][];
  massageServiceUpsert?: Array<{ id: string; basePrice: number }>;
} = {}) {
  const draftFindUnique = vi
    .fn()
    .mockResolvedValueOnce(options.replayDraft ?? null)
    .mockResolvedValueOnce(options.currentDraft ?? null);
  const serviceFindMany = vi.fn();
  for (const result of options.massageServiceFindMany ?? [[], []]) {
    serviceFindMany.mockResolvedValueOnce(result);
  }
  const serviceUpsert = vi.fn();
  for (const result of options.massageServiceUpsert ?? []) {
    serviceUpsert.mockResolvedValueOnce(result);
  }
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    serviceCatalogDraft: {
      findUnique: draftFindUnique,
      upsert: vi.fn().mockResolvedValue(draftRecord()),
    },
    massageService: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: serviceFindMany,
      upsert: serviceUpsert,
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    servicePayoutRule: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(({ data }) => ({ id: `rule-${data.serviceId}`, ...data })),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

function catalogCommand(overrides: Partial<{
  expectedVersion: number;
  intent: 'SAVE_DRAFT' | 'PUBLISH' | 'HIDE' | 'ARCHIVE';
}> = {}) {
  return {
    requestId: 'request-1',
    expectedVersion: 0,
    intent: 'PUBLISH' as const,
    reason: 'Publish complete service pricing',
    nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
    description: 'Relaxing massage',
    priceStep: 100000,
    displayOrder: 10,
    durations: [60, 90, 120].map((durationMin, index) => ({
      durationMin,
      enabled: true,
      basePrice: 500000 + index * 100000,
      providerPayoutAmount: 300000 + index * 100000,
      displayOrder: 10 + index,
    })),
    ...overrides,
  };
}

function draftRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    serviceGroupKey: 'aroma_massage',
    version: 1,
    payload: {},
    lastMutationKey: 'request-1',
    lastMutationHash: 'hash-1',
    createdById: 'admin-1',
    updatedById: 'admin-1',
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    ...overrides,
  };
}

function publishedService(durationMin: number) {
  return {
    id: `service-${durationMin}`,
    serviceGroupKey: 'aroma_massage',
    name: 'Aroma Massage',
    nameTranslations: { en: 'Aroma Massage', vi: 'Massage hương thơm' },
    description: 'Relaxing massage',
    durationMin,
    basePrice: 500000 + ([60, 90, 120].indexOf(durationMin) * 100000),
    priceStep: 100000,
    displayOrder: durationMin,
    active: true,
    publicationStatus: ServicePublicationStatus.PUBLISHED,
    provenance: 'OPERATOR',
    provenanceRunId: null,
    catalogVersion: 1,
    publishedAt: new Date('2026-08-11T00:00:00.000Z'),
    publishedById: 'admin-1',
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    payoutRules: [],
  };
}

function payoutRule(customerPrice: number, providerPayoutAmount: number) {
  return {
    id: `rule-${customerPrice}-${providerPayoutAmount}`,
    serviceId: 'service-60',
    customerPrice,
    providerPayoutAmount,
    vatBps: 0,
    otherCostAmount: 0,
    currency: 'VND',
    notes: null,
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
  };
}
