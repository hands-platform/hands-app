import { ADMIN_PUSH_CAMPAIGN_JOB_NAME } from './admin-push-campaign.queue';
import { AdminPushCampaignProcessor } from './admin-push-campaign.processor';

function campaignFixture(overrides: Record<string, unknown> = {}) {
  return {
    appDestination: 'notificationCenter',
    body: 'Campaign body',
    id: 'campaign-1',
    locale: 'vi',
    processingAt: null,
    status: 'QUEUED',
    targetRole: 'PROVIDER',
    targetSegment: 'ALL',
    title: 'Campaign title',
    recipients: [
      {
        campaignId: 'campaign-1',
        createdAt: new Date('2026-08-13T00:00:00.000Z'),
        notificationId: null,
        status: 'SNAPSHOTTED',
        userId: 'user-1',
      },
    ],
    ...overrides,
  };
}

function jobFixture(name = ADMIN_PUSH_CAMPAIGN_JOB_NAME) {
  return { data: { campaignId: 'campaign-1' }, name } as never;
}

describe('AdminPushCampaignProcessor', () => {
  it('persists and enqueues one notification per snapshotted recipient', async () => {
    const prisma = {
      adminPushCampaign: {
        findUnique: vi.fn().mockResolvedValue(campaignFixture()),
        update: vi.fn().mockResolvedValue({}),
      },
      adminPushCampaignRecipient: { update: vi.fn() },
    };
    const notifications = {
      enqueuePersistedNotification: vi.fn().mockResolvedValue(true),
      persistAdminPushRecipient: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const processor = new AdminPushCampaignProcessor(prisma as never, notifications as never);

    await expect(processor.process(jobFixture())).resolves.toEqual({
      campaignId: 'campaign-1',
      notificationCount: 1,
      queued: true,
    });

    expect(notifications.persistAdminPushRecipient).toHaveBeenCalledTimes(1);
    expect(notifications.enqueuePersistedNotification).toHaveBeenCalledWith('notification-1');
    expect(prisma.adminPushCampaign.update).toHaveBeenLastCalledWith({
      where: { id: 'campaign-1' },
      data: { notificationCount: 1 },
    });
  });

  it('skips terminal recipients when the campaign job retries', async () => {
    const prisma = {
      adminPushCampaign: {
        findUnique: vi.fn().mockResolvedValue(
          campaignFixture({
            status: 'PROCESSING',
            recipients: [
              {
                campaignId: 'campaign-1',
                createdAt: new Date('2026-08-13T00:00:00.000Z'),
                notificationId: 'notification-1',
                status: 'COMPLETED',
                userId: 'user-1',
              },
            ],
          }),
        ),
        update: vi.fn().mockResolvedValue({}),
      },
      adminPushCampaignRecipient: { update: vi.fn() },
    };
    const notifications = {
      enqueuePersistedNotification: vi.fn(),
      persistAdminPushRecipient: vi.fn(),
    };
    const processor = new AdminPushCampaignProcessor(prisma as never, notifications as never);

    await expect(processor.process(jobFixture())).resolves.toEqual({
      campaignId: 'campaign-1',
      notificationCount: 1,
      queued: true,
    });
    expect(notifications.persistAdminPushRecipient).not.toHaveBeenCalled();
    expect(notifications.enqueuePersistedNotification).not.toHaveBeenCalled();
  });

  it('records an enqueue error and lets BullMQ retry the campaign job', async () => {
    const prisma = {
      adminPushCampaign: {
        findUnique: vi.fn().mockResolvedValue(campaignFixture()),
        update: vi.fn().mockResolvedValue({}),
      },
      adminPushCampaignRecipient: { update: vi.fn().mockResolvedValue({}) },
    };
    const notifications = {
      enqueuePersistedNotification: vi.fn().mockResolvedValue(false),
      persistAdminPushRecipient: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const processor = new AdminPushCampaignProcessor(prisma as never, notifications as never);

    await expect(processor.process(jobFixture())).rejects.toThrow(
      'Manual push notification queue enqueue failed',
    );
    expect(prisma.adminPushCampaignRecipient.update).toHaveBeenCalledWith({
      where: { campaignId_userId: { campaignId: 'campaign-1', userId: 'user-1' } },
      data: { lastErrorCode: 'NOTIFICATION_QUEUE_ENQUEUE_FAILED' },
    });
  });

  it('does not process an unsupported job name', async () => {
    const prisma = { adminPushCampaign: { findUnique: vi.fn() } };
    const processor = new AdminPushCampaignProcessor(prisma as never, {} as never);

    await expect(processor.process(jobFixture('other-job'))).resolves.toEqual({
      skipped: true,
      reason: 'UNSUPPORTED_JOB',
    });
    expect(prisma.adminPushCampaign.findUnique).not.toHaveBeenCalled();
  });
});
