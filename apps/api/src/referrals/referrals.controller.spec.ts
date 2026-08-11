import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReferralsController } from './referrals.controller';
import type { ReferralsService } from './referrals.service';

describe('ReferralsController', () => {
  const referrals = {
    claimCustomerReferralCode: vi.fn(),
    claimPartnerReferralCode: vi.fn(),
    getCustomerReferralCode: vi.fn(),
    getCustomerReferralSummary: vi.fn(),
    listCustomerReferralInvites: vi.fn(),
    listCustomerReferralRewards: vi.fn(),
    getPartnerReferralCode: vi.fn(),
    getPartnerReferralSummary: vi.fn(),
    issueCustomerReferralCode: vi.fn(),
    issuePartnerReferralCode: vi.fn(),
    requestCustomerRewardCashout: vi.fn(),
    requestPartnerRewardCashout: vi.fn(),
  };
  const controller = new ReferralsController(referrals as unknown as ReferralsService);
  const user = { id: 'user-1', roles: [Role.CUSTOMER] } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes existing customer referral code as a read-only customer endpoint', async () => {
    referrals.getCustomerReferralCode.mockResolvedValue({ code: 'HCUSTOMER' });

    await expect(controller.customerReferralCode(user)).resolves.toEqual({ code: 'HCUSTOMER' });

    expect(routeMetadata('customerReferralCode')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/referral-code',
    });
    expect(referrals.getCustomerReferralCode).toHaveBeenCalledWith('user-1');
  });

  it('issues customer referral code through an explicit POST action', async () => {
    referrals.issueCustomerReferralCode.mockResolvedValue({ code: 'HCUSTOMER' });

    await expect(controller.issueCustomerReferralCode(user)).resolves.toEqual({ code: 'HCUSTOMER' });

    expect(routeMetadata('issueCustomerReferralCode')).toEqual({
      method: RequestMethod.POST,
      path: 'customer/referral-code',
    });
    expect(referrals.issueCustomerReferralCode).toHaveBeenCalledWith('user-1');
  });

  it('claims customer referral attribution through an explicit POST action', async () => {
    referrals.claimCustomerReferralCode.mockResolvedValue({ id: 'attribution-1' });
    const body = { code: 'HCUSTOMER', platform: 'android', installSource: 'referral-link' } as const;

    await expect(controller.claimCustomerReferralCode(user, body)).resolves.toEqual({ id: 'attribution-1' });

    expect(routeMetadata('claimCustomerReferralCode')).toEqual({
      method: RequestMethod.POST,
      path: 'customer/referrals/claim',
    });
    expect(referrals.claimCustomerReferralCode).toHaveBeenCalledWith('user-1', body);
  });

  it('exposes customer referral summary as a read-only customer endpoint', async () => {
    referrals.getCustomerReferralSummary.mockResolvedValue({ totals: { referralCount: 1 } });

    await expect(controller.customerReferralSummary(user)).resolves.toEqual({ totals: { referralCount: 1 } });

    expect(routeMetadata('customerReferralSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/referrals/summary',
    });
    expect(referrals.getCustomerReferralSummary).toHaveBeenCalledWith('user-1');
  });

  it('lists only the signed-in customer referral invites', async () => {
    referrals.listCustomerReferralInvites.mockResolvedValue({ rows: [] });
    const query = { cursor: 'invite-1', limit: 10 };

    await expect(controller.customerReferralInvites(user, query)).resolves.toEqual({ rows: [] });

    expect(routeMetadata('customerReferralInvites')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/referrals/invites',
    });
    expect(referrals.listCustomerReferralInvites).toHaveBeenCalledWith('user-1', query);
  });

  it('lists only the signed-in customer referral rewards', async () => {
    referrals.listCustomerReferralRewards.mockResolvedValue({ rows: [] });
    const query = { cursor: 'reward-1', limit: 10 };

    await expect(controller.customerReferralRewards(user, query)).resolves.toEqual({ rows: [] });

    expect(routeMetadata('customerReferralRewards')).toEqual({
      method: RequestMethod.GET,
      path: 'customer/referrals/rewards',
    });
    expect(referrals.listCustomerReferralRewards).toHaveBeenCalledWith('user-1', query);
  });

  it('requests customer referral cashout for the signed-in customer', async () => {
    referrals.requestCustomerRewardCashout.mockResolvedValue({
      id: 'reward-1',
      status: 'CASHOUT_REQUESTED',
    });

    await expect(controller.requestCustomerReferralCashout(user, 'reward-1')).resolves.toMatchObject({
      id: 'reward-1',
      status: 'CASHOUT_REQUESTED',
    });

    expect(routeMetadata('requestCustomerReferralCashout')).toEqual({
      method: RequestMethod.POST,
      path: 'customer/referrals/rewards/:rewardId/cashout',
    });
    expect(referrals.requestCustomerRewardCashout).toHaveBeenCalledWith('user-1', 'reward-1');
  });

  it('exposes existing Partner referral code under partner and provider aliases', async () => {
    referrals.getPartnerReferralCode.mockResolvedValue({ code: 'HPARTNER' });

    await expect(controller.partnerReferralCode(user)).resolves.toEqual({ code: 'HPARTNER' });

    expect(routeMetadata('partnerReferralCode')).toEqual({
      method: RequestMethod.GET,
      path: ['partner/referral-code', 'provider/referral-code'],
    });
    expect(referrals.getPartnerReferralCode).toHaveBeenCalledWith('user-1');
  });

  it('issues Partner referral code through an explicit POST action', async () => {
    referrals.issuePartnerReferralCode.mockResolvedValue({ code: 'HPARTNER' });

    await expect(controller.issuePartnerReferralCode(user)).resolves.toEqual({ code: 'HPARTNER' });

    expect(routeMetadata('issuePartnerReferralCode')).toEqual({
      method: RequestMethod.POST,
      path: ['partner/referral-code', 'provider/referral-code'],
    });
    expect(referrals.issuePartnerReferralCode).toHaveBeenCalledWith('user-1');
  });

  it('claims Partner referral attribution through partner and provider aliases', async () => {
    referrals.claimPartnerReferralCode.mockResolvedValue({ id: 'attribution-1' });
    const body = { code: 'HPARTNER', platform: 'ios', installSource: 'referral-link' } as const;

    await expect(controller.claimPartnerReferralCode(user, body)).resolves.toEqual({ id: 'attribution-1' });

    expect(routeMetadata('claimPartnerReferralCode')).toEqual({
      method: RequestMethod.POST,
      path: ['partner/referrals/claim', 'provider/referrals/claim'],
    });
    expect(referrals.claimPartnerReferralCode).toHaveBeenCalledWith('user-1', body);
  });

  it('exposes Partner referral summary under partner and provider aliases', async () => {
    referrals.getPartnerReferralSummary.mockResolvedValue({ totals: { referralCount: 1 } });

    await expect(controller.partnerReferralSummary(user)).resolves.toEqual({ totals: { referralCount: 1 } });

    expect(routeMetadata('partnerReferralSummary')).toEqual({
      method: RequestMethod.GET,
      path: ['partner/referrals/summary', 'provider/referrals/summary'],
    });
    expect(referrals.getPartnerReferralSummary).toHaveBeenCalledWith('user-1');
  });

  it('requests Partner referral cashout through partner and provider aliases', async () => {
    referrals.requestPartnerRewardCashout.mockResolvedValue({
      id: 'reward-2',
      status: 'CASHOUT_REQUESTED',
    });

    await expect(controller.requestPartnerReferralCashout(user, 'reward-2')).resolves.toMatchObject({
      id: 'reward-2',
      status: 'CASHOUT_REQUESTED',
    });

    expect(routeMetadata('requestPartnerReferralCashout')).toEqual({
      method: RequestMethod.POST,
      path: ['partner/referrals/rewards/:rewardId/cashout', 'provider/referrals/rewards/:rewardId/cashout'],
    });
    expect(referrals.requestPartnerRewardCashout).toHaveBeenCalledWith('user-1', 'reward-2');
  });
});

function routeMetadata(methodName: keyof ReferralsController) {
  const handler = ReferralsController.prototype[methodName];

  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
