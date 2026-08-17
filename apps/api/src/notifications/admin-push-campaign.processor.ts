import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_PUSH_CAMPAIGN_JOB_NAME,
  ADMIN_PUSH_CAMPAIGN_QUEUE_NAME,
  type AdminPushCampaignJob,
} from './admin-push-campaign.queue';
import { NotificationsService } from './notifications.service';

@Processor({ name: ADMIN_PUSH_CAMPAIGN_QUEUE_NAME, configKey: 'worker' })
export class AdminPushCampaignProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<AdminPushCampaignJob>) {
    if (job.name !== ADMIN_PUSH_CAMPAIGN_JOB_NAME) {
      return { skipped: true, reason: 'UNSUPPORTED_JOB' };
    }
    const campaign = await this.prisma.adminPushCampaign.findUnique({
      where: { id: job.data.campaignId },
      include: { recipients: { orderBy: { createdAt: 'asc' } } },
    });
    if (!campaign || !['QUEUED', 'PROCESSING'].includes(campaign.status)) {
      return { skipped: true, reason: 'CAMPAIGN_NOT_QUEUEABLE' };
    }

    const processingAt = campaign.processingAt ?? new Date();
    await this.prisma.adminPushCampaign.update({
      where: { id: campaign.id },
      data: { processingAt, status: 'PROCESSING' },
    });

    let notificationCount = 0;
    for (const recipient of campaign.recipients) {
      if (['COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'SKIPPED'].includes(recipient.status)) {
        notificationCount += recipient.notificationId ? 1 : 0;
        continue;
      }
      let notificationId = recipient.notificationId;
      if (!notificationId) {
        const notification = await this.notifications.persistAdminPushRecipient({
          body: campaign.body,
          campaignId: campaign.id,
          data: {
            campaignId: campaign.id,
            destination: campaign.appDestination,
            locale: campaign.locale,
            source: 'admin_manual_push',
            targetSegment: campaign.targetSegment,
          },
          locale: campaign.locale ?? undefined,
          resolveTemplate: false,
          targetRole: campaign.targetRole === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER',
          title: campaign.title,
          type: 'admin.push.broadcast',
          userId: recipient.userId,
        });
        notificationId = notification.id;
      }
      notificationCount += 1;

      const queued = await this.notifications.enqueuePersistedNotification(notificationId);
      if (!queued) {
        await this.prisma.adminPushCampaignRecipient.update({
          where: { campaignId_userId: { campaignId: campaign.id, userId: recipient.userId } },
          data: { lastErrorCode: 'NOTIFICATION_QUEUE_ENQUEUE_FAILED' },
        });
        throw new Error('Manual push notification queue enqueue failed');
      }
    }

    await this.prisma.adminPushCampaign.update({
      where: { id: campaign.id },
      data: { notificationCount },
    });
    return { campaignId: campaign.id, notificationCount, queued: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AdminPushCampaignJob> | undefined) {
    if (!job || job.name !== ADMIN_PUSH_CAMPAIGN_JOB_NAME) return;
    const attempts = Math.max(1, job.opts.attempts ?? 1);
    if (job.attemptsMade < attempts) return;
    await this.prisma.adminPushCampaign.updateMany({
      where: {
        id: job.data.campaignId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
      data: { failedAt: new Date(), status: 'FAILED' },
    });
  }
}
