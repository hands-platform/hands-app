import { AdminOperatorPermissionCategory, PrismaClient, Role } from '@prisma/client';

import { disposableIntegrationDatabaseTarget } from '../common/disposable-integration-database';
import { AdminService } from './admin.service';

const integrationEnabled = process.env.RUN_OPERATIONS_HANDOFF_DB_INTEGRATION === '1';
const integrationTarget = integrationEnabled
  ? disposableIntegrationDatabaseTarget(process.env.DATABASE_URL, process.env.INTEGRATION_DATABASE_ALLOWLIST)
  : null;
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('Operations shift handoff PostgreSQL concurrency', () => {
  const prisma = new PrismaClient({
    ...(integrationTarget ? { datasources: { db: { url: integrationTarget.databaseUrl } } } : {}),
  });
  const runId = `operations-handoff-concurrency-${Date.now()}`;
  const incomingOperatorId = `${runId}-incoming`;
  const outgoingOperatorId = `${runId}-outgoing`;
  const recipientId = `${runId}-recipient`;
  const pushDeviceId = `${runId}-device`;
  const acknowledgementTarget = `operations:shift_handoff:${runId}`;
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: incomingOperatorId,
          fullName: 'Incoming concurrency operator',
          phone: `admin:${incomingOperatorId}`,
          roles: [Role.ADMIN],
        },
        {
          id: outgoingOperatorId,
          fullName: 'Outgoing concurrency operator',
          phone: `admin:${outgoingOperatorId}`,
          roles: [Role.ADMIN],
        },
        {
          id: recipientId,
          fullName: 'Notification concurrency recipient',
          phone: `customer:${recipientId}`,
          roles: [Role.CUSTOMER],
        },
      ],
    });
    await prisma.adminOperatorCredential.createMany({
      data: [incomingOperatorId, outgoingOperatorId].map((userId) => ({
        email: `${userId}@hands.test`,
        passwordHash: 'integration-only-hash',
        passwordSalt: 'integration-only-salt',
        setupCompletedAt: new Date(),
        userId,
      })),
    });
    await prisma.adminOperatorPermission.createMany({
      data: [incomingOperatorId, outgoingOperatorId].map((userId) => ({
        categories: [AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY],
        userId,
      })),
    });
    await prisma.pushDevice.create({
      data: {
        id: pushDeviceId,
        platform: 'integration',
        role: Role.CUSTOMER,
        token: `${runId}-token`,
        userId: recipientId,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        actorId: outgoingOperatorId,
        action: 'operations.shift_handoff.create',
        id: runId,
        metadata: {
          expectedOpenCaseCount: 0,
          followUpOwner: 'Incoming concurrency operator',
          followUpOwnerId: incomingOperatorId,
          incomingOperator: 'Incoming concurrency operator',
          incomingOperatorId,
          note: 'No open cases at handoff time',
          outgoingShift: 'Concurrency integration shift',
          owner: 'Incoming concurrency operator',
          ownerId: incomingOperatorId,
          unresolvedCases: [],
          unresolvedCaseIds: [],
        },
        target: 'operations:shift_handoff',
      },
    });
  });

  afterAll(async () => {
    await prisma.notificationDelivery.deleteMany({ where: { pushDeviceId } });
    await prisma.notification.deleteMany({ where: { userId: recipientId } });
    await prisma.pushDevice.deleteMany({ where: { id: pushDeviceId } });
    await prisma.$disconnect();
  });

  it('stores exactly one acknowledgement across ten concurrent requests', async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.acknowledgeOperationsShiftHandoff(incomingOperatorId, runId)),
    );

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(9);
    await expect(
      prisma.adminAuditLog.count({
        where: {
          action: 'operations.shift_handoff.acknowledge',
          target: acknowledgementTarget,
        },
      }),
    ).resolves.toBe(1);
  }, 30_000);

  it('rejects a clear handoff when a concurrent new open case owns the queue revision first', async () => {
    const notificationId = `${runId}-new-open-case`;
    const deliveryId = `${notificationId}-failed`;
    const writerHasRevisionLock = deferred();
    const releaseWriter = deferred();
    const auditCountBefore = await handoffCreateCount(prisma, outgoingOperatorId);
    const writer = prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          body: 'Concurrent open case',
          data: { dataScope: 'production' },
          id: notificationId,
          title: 'Concurrent open case',
          type: 'OPERATIONS_HANDOFF_CONCURRENCY',
          userId: recipientId,
        },
      });
      await tx.notificationDelivery.create({
        data: {
          id: deliveryId,
          notificationId,
          provider: 'integration',
          pushDeviceId,
          status: 'FAILED',
        },
      });
      writerHasRevisionLock.resolve();
      await releaseWriter.promise;
    });

    try {
      await writerHasRevisionLock.promise;
      const handoff = service.createOperationsShiftHandoff(outgoingOperatorId, {
        expectedOpenCaseCount: 0,
        incomingOperatorId,
        outgoingShift: 'Concurrent clear handoff shift',
        ownerId: incomingOperatorId,
      });
      await expect(waitForBlockedOperation(handoff)).resolves.toBe('blocked');
      releaseWriter.resolve();
      await writer;
      await expect(
        service.listOperationsHandoffOpenCases({ actorId: outgoingOperatorId }),
      ).resolves.toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ caseId: notificationId, queueKey: 'notification-failures' }),
        ]),
      });

      await expect(handoff).rejects.toThrow(
        'Some selected cases are no longer open. Review the list and try again.',
      );
      await expect(handoffCreateCount(prisma, outgoingOperatorId)).resolves.toBe(auditCountBefore);
    } finally {
      releaseWriter.resolve();
      await writer.catch(() => undefined);
      await prisma.notificationDelivery.deleteMany({ where: { id: deliveryId } });
      await prisma.notification.deleteMany({ where: { id: notificationId } });
    }
  }, 30_000);

  it('keeps a new open case from committing between a clear snapshot and its audit row', async () => {
    const notificationId = `${runId}-after-clear-snapshot`;
    const deliveryId = `${notificationId}-failed`;
    const snapshotRead = deferred();
    const releaseHandoff = deferred();
    const handoffService = service as unknown as HandoffServiceWithOpenCaseRows;
    const originalOpenCaseRows = handoffService.operationsHandoffOpenCaseRows.bind(service);
    const auditCountBefore = await handoffCreateCount(prisma, outgoingOperatorId);
    handoffService.operationsHandoffOpenCaseRows = async (client) => {
      const rows = await originalOpenCaseRows(client);
      snapshotRead.resolve();
      await releaseHandoff.promise;
      return rows;
    };

    let writer: Promise<unknown> | null = null;
    try {
      const handoff = service.createOperationsShiftHandoff(outgoingOperatorId, {
        expectedOpenCaseCount: 0,
        incomingOperatorId,
        outgoingShift: 'Clear snapshot barrier shift',
        ownerId: incomingOperatorId,
      });
      await snapshotRead.promise;
      writer = prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            body: 'Open case after clear snapshot',
            data: { dataScope: 'production' },
            id: notificationId,
            title: 'Open case after clear snapshot',
            type: 'OPERATIONS_HANDOFF_CONCURRENCY',
            userId: recipientId,
          },
        });
        await tx.notificationDelivery.create({
          data: {
            id: deliveryId,
            notificationId,
            provider: 'integration',
            pushDeviceId,
            status: 'FAILED',
          },
        });
      });
      await expect(waitForBlockedOperation(writer)).resolves.toBe('blocked');
      releaseHandoff.resolve();

      await expect(handoff).resolves.toMatchObject({ ok: true });
      await writer;
      await expect(handoffCreateCount(prisma, outgoingOperatorId)).resolves.toBe(auditCountBefore + 1);
      await expect(
        service.listOperationsHandoffOpenCases({ actorId: outgoingOperatorId }),
      ).resolves.toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ caseId: notificationId, queueKey: 'notification-failures' }),
        ]),
      });
    } finally {
      releaseHandoff.resolve();
      handoffService.operationsHandoffOpenCaseRows = originalOpenCaseRows;
      await writer?.catch(() => undefined);
      await prisma.notificationDelivery.deleteMany({ where: { id: deliveryId } });
      await prisma.notification.deleteMany({ where: { id: notificationId } });
    }
  }, 30_000);

  it('rejects a selected case when a concurrent resolution owns the queue revision first', async () => {
    const notificationId = `${runId}-resolved-case`;
    const deliveryId = `${notificationId}-failed`;
    await prisma.notification.create({
      data: {
        body: 'Concurrent selected case',
        data: { dataScope: 'production' },
        id: notificationId,
        title: 'Concurrent selected case',
        type: 'OPERATIONS_HANDOFF_CONCURRENCY',
        userId: recipientId,
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        id: deliveryId,
        notificationId,
        provider: 'integration',
        pushDeviceId,
        status: 'FAILED',
      },
    });
    await expect(
      service.listOperationsHandoffOpenCases({ actorId: outgoingOperatorId }),
    ).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ caseId: notificationId, queueKey: 'notification-failures' }),
      ]),
    });
    const resolverHasRevisionLock = deferred();
    const releaseResolver = deferred();
    const auditCountBefore = await handoffCreateCount(prisma, outgoingOperatorId);
    const resolver = prisma.$transaction(async (tx) => {
      await tx.notificationDelivery.update({
        data: { status: 'SUCCESS' },
        where: { id: deliveryId },
      });
      resolverHasRevisionLock.resolve();
      await releaseResolver.promise;
    });

    try {
      await resolverHasRevisionLock.promise;
      const handoff = service.createOperationsShiftHandoff(outgoingOperatorId, {
        expectedOpenCaseCount: 1,
        incomingOperatorId,
        note: 'Continue notification recovery.',
        outgoingShift: 'Concurrent selected-case shift',
        ownerId: incomingOperatorId,
        unresolvedCases: [{ caseId: notificationId, queueKey: 'notification-failures' }],
      });
      await expect(waitForBlockedOperation(handoff)).resolves.toBe('blocked');
      releaseResolver.resolve();
      await resolver;

      await expect(handoff).rejects.toThrow(
        'Some selected cases are no longer open. Review the list and try again.',
      );
      await expect(handoffCreateCount(prisma, outgoingOperatorId)).resolves.toBe(auditCountBefore);
    } finally {
      releaseResolver.resolve();
      await resolver.catch(() => undefined);
      await prisma.notificationDelivery.deleteMany({ where: { id: deliveryId } });
      await prisma.notification.deleteMany({ where: { id: notificationId } });
    }
  }, 30_000);
});

type HandoffOpenCaseRow = {
  amount: bigint;
  caseId: string;
  key: string;
  occurredAt: Date;
  slaMinutes: number;
};

type HandoffServiceWithOpenCaseRows = {
  operationsHandoffOpenCaseRows(client?: unknown): Promise<HandoffOpenCaseRow[]>;
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function handoffCreateCount(prisma: PrismaClient, actorId: string) {
  return prisma.adminAuditLog.count({
    where: { action: 'operations.shift_handoff.create', actorId },
  });
}

function waitForBlockedOperation(operation: Promise<unknown>) {
  return Promise.race([
    operation.then(
      () => 'settled',
      () => 'settled',
    ),
    new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 150)),
  ]);
}
