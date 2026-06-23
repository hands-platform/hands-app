import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReferralsController } from './referrals.controller';
import type { ReferralsService } from './referrals.service';

describe('ReferralsController', () => {
  const referrals = {
    getCustomerReferralCode: jest.fn(),
    getPartnerReferralCode: jest.fn(),
    issueCustomerReferralCode: jest.fn(),
    issuePartnerReferralCode: jest.fn(),
  };
  const controller = new ReferralsController(referrals as unknown as ReferralsService);
  const user = { id: 'user-1', roles: [Role.CUSTOMER] } as AuthenticatedUser;

  beforeEach(() => {
    jest.clearAllMocks();
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
});

function routeMetadata(methodName: keyof ReferralsController) {
  const handler = ReferralsController.prototype[methodName];

  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
