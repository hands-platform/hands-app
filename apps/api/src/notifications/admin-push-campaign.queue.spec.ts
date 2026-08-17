import {
  ADMIN_PUSH_CAMPAIGN_JOB_NAME,
  adminPushCampaignJob,
} from './admin-push-campaign.queue';

describe('adminPushCampaignJob', () => {
  it('queues one retryable job keyed by campaign ID', () => {
    expect(adminPushCampaignJob('campaign-1')).toEqual({
      name: ADMIN_PUSH_CAMPAIGN_JOB_NAME,
      data: { campaignId: 'campaign-1' },
      options: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        deduplication: { id: 'campaign-1', keepLastIfActive: true },
        removeOnComplete: true,
        removeOnFail: { count: 500 },
      },
    });
  });
});
