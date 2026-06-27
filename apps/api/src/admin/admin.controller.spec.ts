import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ReferralRewardMode } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController notification and push actions', () => {
  const admin = {
    enablePushDevice: vi.fn(),
    listFileReviewProviders: vi.fn(),
    getMarketingOverview: vi.fn(),
    getUsageOverview: vi.fn(),
    getVietnamOverview: vi.fn(),
    getCustomerReferralParent: vi.fn(),
    getPartnerReferralParent: vi.fn(),
    listCustomerReferralParents: vi.fn(),
    listPartnerReferralParents: vi.fn(),
    listReferralPolicies: vi.fn(),
    listOperationsHandoffProviders: vi.fn(),
    listOperationsPolicyProviders: vi.fn(),
    listNotifications: vi.fn(),
    listNotificationTemplates: vi.fn(),
    listPartnerControlProviders: vi.fn(),
    listPartnerDirectoryProviders: vi.fn(),
    listAdminPushCampaigns: vi.fn(),
    previewAdminPushCampaign: vi.fn(),
    createAdminPushCampaign: vi.fn(),
    creditReferralReward: vi.fn(),
    holdReferralReward: vi.fn(),
    releaseAvailableReferralRewards: vi.fn(),
    reverseReferralReward: vi.fn(),
    deleteCoupon: vi.fn(),
    retryNotification: vi.fn(),
    updateNotificationTemplate: vi.fn(),
    updateReferralPolicy: vi.fn(),
    upsertMarketingSpendDaily: vi.fn(),
  };
  const controller = new AdminController(admin as unknown as AdminService);
  const user = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes push device enablement as a POST action and delegates with actor id', async () => {
    admin.enablePushDevice.mockResolvedValue({ ok: true, pushDeviceId: 'push-device-1' });

    await expect(controller.enablePushDevice(user, 'push-device-1')).resolves.toEqual({
      ok: true,
      pushDeviceId: 'push-device-1',
    });

    expect(routeMetadata('enablePushDevice')).toEqual({
      method: RequestMethod.POST,
      path: 'push-devices/:id/enable',
    });
    expect(admin.enablePushDevice).toHaveBeenCalledWith('admin-1', 'push-device-1');
  });

  it('exposes notification retry as a POST action and delegates with actor id', async () => {
    admin.retryNotification.mockResolvedValue({ ok: true, notificationId: 'notification-1' });

    await expect(controller.retryNotification(user, 'notification-1')).resolves.toEqual({
      ok: true,
      notificationId: 'notification-1',
    });

    expect(routeMetadata('retryNotification')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/:id/retry',
    });
    expect(admin.retryNotification).toHaveBeenCalledWith('admin-1', 'notification-1');
  });

  it('exposes notifications as a bounded board list', async () => {
    admin.listNotifications.mockResolvedValue([{ id: 'notification-1' }]);

    await expect(
      controller.notifications('25', '2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z'),
    ).resolves.toEqual([{ id: 'notification-1' }]);

    expect(routeMetadata('notifications')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications',
    });
    expect(admin.listNotifications).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes notification templates as a GET catalog', async () => {
    admin.listNotificationTemplates.mockResolvedValue([{ key: 'booking.matched' }]);

    await expect(controller.notificationTemplates()).resolves.toEqual([{ key: 'booking.matched' }]);

    expect(routeMetadata('notificationTemplates')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/templates',
    });
    expect(admin.listNotificationTemplates).toHaveBeenCalledWith();
  });

  it('exposes notification template copy updates as an audited PATCH action', async () => {
    const body = {
      locale: 'en',
      title: 'Booking matched',
      body: 'Your booking has a Partner.',
      enabled: true,
    };
    admin.updateNotificationTemplate.mockResolvedValue({ key: 'booking.matched' });

    await expect(controller.updateNotificationTemplate(user, 'booking.matched', body)).resolves.toEqual({
      key: 'booking.matched',
    });

    expect(routeMetadata('updateNotificationTemplate')).toEqual({
      method: RequestMethod.PATCH,
      path: 'notifications/templates/:key',
    });
    expect(admin.updateNotificationTemplate).toHaveBeenCalledWith('admin-1', 'booking.matched', body);
  });

  it('exposes manual push campaigns with preview before send', async () => {
    const body = {
      targetRole: 'CUSTOMER' as never,
      locale: 'en',
      title: 'HANDS update',
      body: 'Your booking update is ready.',
    };
    admin.listAdminPushCampaigns.mockResolvedValue([{ id: 'campaign-1' }]);
    admin.previewAdminPushCampaign.mockResolvedValue({ recipientCount: 2, willSendCount: 2 });
    admin.createAdminPushCampaign.mockResolvedValue({ id: 'campaign-1' });

    await expect(
      controller.pushCampaigns('25', '2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z'),
    ).resolves.toEqual([{ id: 'campaign-1' }]);
    await expect(controller.previewPushCampaign(body)).resolves.toEqual({
      recipientCount: 2,
      willSendCount: 2,
    });
    await expect(controller.createPushCampaign(user, body)).resolves.toEqual({ id: 'campaign-1' });

    expect(routeMetadata('pushCampaigns')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/push-campaigns',
    });
    expect(routeMetadata('previewPushCampaign')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/push-campaigns/preview',
    });
    expect(routeMetadata('createPushCampaign')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/push-campaigns',
    });
    expect(admin.listAdminPushCampaigns).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });
    expect(admin.createAdminPushCampaign).toHaveBeenCalledWith('admin-1', body);
  });

  it('exposes coupon deletion as an audited DELETE action', async () => {
    admin.deleteCoupon.mockResolvedValue({ couponId: 'coupon-1', ok: true });

    await expect(controller.deleteCoupon(user, 'coupon-1')).resolves.toEqual({
      couponId: 'coupon-1',
      ok: true,
    });

    expect(routeMetadata('deleteCoupon')).toEqual({
      method: RequestMethod.DELETE,
      path: 'coupons/:id',
    });
    expect(admin.deleteCoupon).toHaveBeenCalledWith('admin-1', 'coupon-1');
  });

  it('exposes file review providers as a lightweight GET list', async () => {
    admin.listFileReviewProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.fileReviewProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('fileReviewProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-providers',
    });
    expect(admin.listFileReviewProviders).toHaveBeenCalledWith();
  });

  it('exposes operations policy providers as a lightweight GET list', async () => {
    admin.listOperationsPolicyProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsPolicyProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsPolicyProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-policy/providers',
    });
    expect(admin.listOperationsPolicyProviders).toHaveBeenCalledWith();
  });

  it('exposes Vietnam region overview as an aggregate GET list', async () => {
    admin.getVietnamOverview.mockResolvedValue({ regions: [] });

    await expect(controller.vietnamOverview()).resolves.toEqual({ regions: [] });

    expect(routeMetadata('vietnamOverview')).toEqual({
      method: RequestMethod.GET,
      path: ['vietnam-overview', 'maps/vietnam-overview'],
    });
    expect(admin.getVietnamOverview).toHaveBeenCalledWith(undefined);
  });

  it('exposes usage overview as a bounded aggregate GET list', async () => {
    admin.getUsageOverview.mockResolvedValue({ range: 'month', customerUsage: [], partnerUsage: [] });

    await expect(controller.usageOverview('month')).resolves.toEqual({
      range: 'month',
      customerUsage: [],
      partnerUsage: [],
    });

    expect(routeMetadata('usageOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'usage-overview',
    });
    expect(admin.getUsageOverview).toHaveBeenCalledWith('month');
  });

  it('exposes marketing overview as a separate aggregate GET endpoint', async () => {
    admin.getMarketingOverview.mockResolvedValue({ source: 'stored-marketing-aggregates', bySource: [] });

    await expect(controller.marketingOverview('7d', 'referral', 'ios', 'hcm', 'ref-smoke')).resolves.toEqual({
      source: 'stored-marketing-aggregates',
      bySource: [],
    });

    expect(routeMetadata('marketingOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/overview',
    });
    expect(admin.getMarketingOverview).toHaveBeenCalledWith({
      range: '7d',
      source: 'referral',
      platform: 'ios',
      regionCode: 'hcm',
      campaignId: 'ref-smoke',
    });
  });

  it('exposes manual marketing spend upserts as an audited POST action', async () => {
    const body = {
      spendDate: '2026-06-20',
      source: 'Google Ads',
      platform: 'ANDROID',
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
      spendAmount: 600000,
    };
    admin.upsertMarketingSpendDaily.mockResolvedValue({ id: 'marketing-spend-1' });

    await expect(controller.upsertMarketingSpendDaily(user, body)).resolves.toEqual({
      id: 'marketing-spend-1',
    });

    expect(routeMetadata('upsertMarketingSpendDaily')).toEqual({
      method: RequestMethod.POST,
      path: 'marketing/spend-daily',
    });
    expect(admin.upsertMarketingSpendDaily).toHaveBeenCalledWith('admin-1', body);
  });

  it('exposes referral policy settings as a read-only GET endpoint', async () => {
    admin.listReferralPolicies.mockResolvedValue({
      customer: { enabled: false },
      partner: { enabled: false },
    });

    await expect(controller.referralPolicies()).resolves.toEqual({
      customer: { enabled: false },
      partner: { enabled: false },
    });

    expect(routeMetadata('referralPolicies')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/policies',
    });
    expect(admin.listReferralPolicies).toHaveBeenCalledWith();
  });

  it('exposes referral policy updates as an audited PATCH action', async () => {
    admin.updateReferralPolicy.mockResolvedValue({ audience: 'CUSTOMER', enabled: true });

    await expect(
      controller.updateReferralPolicy(user, 'customer', {
        enabled: true,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        commissionPercentBps: 500,
      }),
    ).resolves.toEqual({ audience: 'CUSTOMER', enabled: true });

    expect(routeMetadata('updateReferralPolicy')).toEqual({
      method: RequestMethod.PATCH,
      path: 'referrals/policies/:audience',
    });
    expect(admin.updateReferralPolicy).toHaveBeenCalledWith('admin-1', 'customer', {
      enabled: true,
      rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
      commissionPercentBps: 500,
    });
  });

  it('exposes customer referral parent accounts without listing every customer', async () => {
    admin.listCustomerReferralParents.mockResolvedValue([{ referrer: { id: 'customer-1' } }]);

    await expect(controller.customerReferralParents()).resolves.toEqual([{ referrer: { id: 'customer-1' } }]);

    expect(routeMetadata('customerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers',
    });
    expect(admin.listCustomerReferralParents).toHaveBeenCalledWith();
  });

  it('exposes a customer referral parent detail only for referral activity drilldown', async () => {
    admin.getCustomerReferralParent.mockResolvedValue({ referrer: { id: 'customer-1' } });

    await expect(controller.customerReferralParent('customer-1')).resolves.toEqual({
      referrer: { id: 'customer-1' },
    });

    expect(routeMetadata('customerReferralParent')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers/:id',
    });
    expect(admin.getCustomerReferralParent).toHaveBeenCalledWith('customer-1');
  });

  it('exposes partner referral parent accounts without listing every partner', async () => {
    admin.listPartnerReferralParents.mockResolvedValue([{ referrer: { id: 'partner-1' } }]);

    await expect(controller.partnerReferralParents()).resolves.toEqual([{ referrer: { id: 'partner-1' } }]);

    expect(routeMetadata('partnerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners',
    });
    expect(admin.listPartnerReferralParents).toHaveBeenCalledWith();
  });

  it('exposes referral reward hold-window release as a POST action', async () => {
    admin.releaseAvailableReferralRewards.mockResolvedValue({ releasedCount: 2 });

    await expect(controller.releaseAvailableReferralRewards(user)).resolves.toEqual({ releasedCount: 2 });

    expect(routeMetadata('releaseAvailableReferralRewards')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/release-available',
    });
    expect(admin.releaseAvailableReferralRewards).toHaveBeenCalledWith('admin-1');
  });

  it('exposes referral reward hold as a POST action', async () => {
    admin.holdReferralReward.mockResolvedValue({ id: 'reward-1', status: 'HELD' });

    await expect(controller.holdReferralReward(user, 'reward-1', { reason: 'review' })).resolves.toEqual({
      id: 'reward-1',
      status: 'HELD',
    });

    expect(routeMetadata('holdReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/hold',
    });
    expect(admin.holdReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'review' });
  });

  it('exposes referral reward wallet credit as a POST action', async () => {
    admin.creditReferralReward.mockResolvedValue({
      id: 'reward-1',
      status: 'REWARDED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    await expect(controller.creditReferralReward(user, 'reward-1', { reason: 'ready' })).resolves.toEqual({
      id: 'reward-1',
      status: 'REWARDED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(routeMetadata('creditReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/credit',
    });
    expect(admin.creditReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'ready' });
  });

  it('exposes referral reward reverse as a POST action', async () => {
    admin.reverseReferralReward.mockResolvedValue({ id: 'reward-1', status: 'REVERSED' });

    await expect(controller.reverseReferralReward(user, 'reward-1', { reason: 'invalid' })).resolves.toEqual({
      id: 'reward-1',
      status: 'REVERSED',
    });

    expect(routeMetadata('reverseReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/reverse',
    });
    expect(admin.reverseReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'invalid' });
  });

  it('exposes a partner referral parent detail only for referral activity drilldown', async () => {
    admin.getPartnerReferralParent.mockResolvedValue({ referrer: { id: 'partner-1' } });

    await expect(controller.partnerReferralParent('partner-1')).resolves.toEqual({
      referrer: { id: 'partner-1' },
    });

    expect(routeMetadata('partnerReferralParent')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners/:id',
    });
    expect(admin.getPartnerReferralParent).toHaveBeenCalledWith('partner-1');
  });

  it('exposes operations handoff providers as a lightweight GET list', async () => {
    admin.listOperationsHandoffProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsHandoffProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsHandoffProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/providers',
    });
    expect(admin.listOperationsHandoffProviders).toHaveBeenCalledWith();
  });

  it('exposes partner control providers as a lightweight GET list', async () => {
    admin.listPartnerControlProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.partnerControlProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerControlProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-controls/providers',
    });
    expect(admin.listPartnerControlProviders).toHaveBeenCalledWith();
  });

  it('exposes partner directory providers as a lightweight GET list', async () => {
    admin.listPartnerDirectoryProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.partnerDirectoryProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerDirectoryProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partners/list-providers',
    });
    expect(admin.listPartnerDirectoryProviders).toHaveBeenCalledWith();
  });
});

function routeMetadata(methodName: keyof AdminController) {
  const handler = AdminController.prototype[methodName] as unknown as (...args: unknown[]) => unknown;
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
