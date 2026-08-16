import { PrismaClient, Role } from '@prisma/client';

const integrationDescribe =
  process.env.RUN_ADMIN_PUSH_DB_INTEGRATION === '1' ? describe : describe.skip;

integrationDescribe('Admin push campaign PostgreSQL invariants', () => {
  const prisma = new PrismaClient();
  const runId = `admin-push-integration-${Date.now()}`;

  afterEach(async () => {
    await prisma.adminPushCampaign.deleteMany({
      where: { createdById: { startsWith: runId } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows only one atomic preview consumption under concurrent confirms', async () => {
    const campaign = await createPreview('consume');

    const outcomes = await Promise.all([
      consumePreview(campaign.id),
      consumePreview(campaign.id),
    ]);

    expect(outcomes.map((outcome) => outcome.count).sort()).toEqual([0, 1]);
    expect(
      await prisma.adminPushCampaign.count({
        where: { id: campaign.id, status: 'QUEUED', consumedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('enforces one campaign per idempotency key and one recipient snapshot per user', async () => {
    const idempotencyKey = `${runId}:same-confirm`;
    const createCampaign = () =>
      prisma.adminPushCampaign.create({
        data: {
          targetRole: Role.CUSTOMER,
          locale: 'vi',
          title: 'Integration title',
          body: 'Integration body',
          createdById: `${runId}:actor`,
          idempotencyKey,
        },
      });
    const campaignResults = await Promise.allSettled([createCampaign(), createCampaign()]);
    const campaign = campaignResults.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createCampaign>>> =>
        result.status === 'fulfilled',
    )?.value;

    expect(campaign).toBeDefined();
    expect(campaignResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.adminPushCampaign.count({ where: { idempotencyKey } })).toBe(1);

    const createRecipient = () =>
      prisma.adminPushCampaignRecipient.create({
        data: {
          campaignId: campaign!.id,
          userId: `${runId}:recipient`,
          eligibleDeviceCount: 1,
          deviceIds: [`${runId}:device`],
        },
      });
    const recipientResults = await Promise.allSettled([createRecipient(), createRecipient()]);

    expect(recipientResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.adminPushCampaignRecipient.count({
        where: { campaignId: campaign!.id, userId: `${runId}:recipient` },
      }),
    ).toBe(1);
  });

  function createPreview(suffix: string) {
    return prisma.adminPushCampaign.create({
      data: {
        targetRole: Role.CUSTOMER,
        locale: 'vi',
        title: 'Integration title',
        body: 'Integration body',
        createdById: `${runId}:${suffix}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
      },
    });
  }

  function consumePreview(id: string) {
    return prisma.adminPushCampaign.updateMany({
      where: { id, status: 'PREVIEWED', consumedAt: null },
      data: {
        status: 'QUEUED',
        consumedAt: new Date(),
        confirmedAt: new Date(),
        queuedAt: new Date(),
      },
    });
  }
});
