const ADMIN_PUSH_CAMPAIGN_ATTEMPTS = 3;
const ADMIN_PUSH_CAMPAIGN_BACKOFF_MS = 5_000;

export const ADMIN_PUSH_CAMPAIGN_QUEUE_NAME = 'admin-push-campaign';
export const ADMIN_PUSH_CAMPAIGN_JOB_NAME = 'admin-push-campaign-send';

export type AdminPushCampaignJob = {
  campaignId: string;
};

export function adminPushCampaignJob(campaignId: string) {
  return {
    name: ADMIN_PUSH_CAMPAIGN_JOB_NAME,
    data: { campaignId },
    options: {
      attempts: ADMIN_PUSH_CAMPAIGN_ATTEMPTS,
      backoff: { type: 'exponential', delay: ADMIN_PUSH_CAMPAIGN_BACKOFF_MS },
      deduplication: { id: campaignId, keepLastIfActive: true },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}
