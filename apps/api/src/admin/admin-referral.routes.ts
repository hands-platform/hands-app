import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ReferralRewardCashoutPaidDto,
  ReferralRewardDecisionDto,
  ReferralRewardTaxDecisionDto,
  UpdateReferralPolicyDto,
} from './admin.dto';
import { AdminAnalyticsRoutes } from './admin-analytics.routes';

export class AdminReferralRoutes extends AdminAnalyticsRoutes {
  @Get('referrals/policies')
  referralPolicies() {
    return this.admin.listReferralPolicies();
  }

  @Patch('referrals/policies/:audience')
  updateReferralPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('audience') audience: string,
    @Body() body: UpdateReferralPolicyDto,
  ) {
    return this.admin.updateReferralPolicy(user.id, audience, body);
  }

  @Post('referrals/rewards/release-available')
  releaseAvailableReferralRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.releaseAvailableReferralRewards(user.id);
  }

  @Post('referrals/rewards/:id/hold')
  holdReferralReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.holdReferralReward(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/credit')
  creditReferralReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.creditReferralReward(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/release')
  releaseHeldReferralReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.releaseHeldReferralReward(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/cashout-approve')
  approveReferralRewardCashout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.approveReferralRewardCashout(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/tax-review')
  requireReferralRewardTaxReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.requireReferralRewardTaxReview(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/tax-review-approve')
  approveReferralRewardTaxReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardTaxDecisionDto,
  ) {
    return this.admin.approveReferralRewardTaxReview(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/tax-review-hold')
  holdReferralRewardTaxReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardTaxDecisionDto,
  ) {
    return this.admin.holdReferralRewardTaxReview(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/tax-review-reject')
  rejectReferralRewardTaxReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardTaxDecisionDto,
  ) {
    return this.admin.rejectReferralRewardTaxReview(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/cashout-paid')
  markReferralRewardCashoutPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardCashoutPaidDto,
  ) {
    return this.admin.markReferralRewardCashoutPaid(user.id, rewardId, body);
  }

  @Post('referrals/rewards/:id/reverse')
  reverseReferralReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.reverseReferralReward(user.id, rewardId, body);
  }

  @Get('referrals/cashouts')
  referralCashoutQueue(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('audience') audience?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listReferralCashoutQueue({ take, skip, audience, status, q });
  }

  @Get('referrals/cashouts/summary')
  referralCashoutQueueSummary(
    @Query('audience') audience?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.referralCashoutQueueSummary({ audience, status, q });
  }

  @Get('referrals/customers')
  customerReferralParents(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.listCustomerReferralParents({ take, skip, q, status, reward, fraud, range });
  }

  @Get('referrals/customers/summary')
  customerReferralParentSummary(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.customerReferralParentSummary({ q, status, reward, fraud, range });
  }

  @Get('referrals/customers/rewards')
  customerReferralRewardQueue(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.listCustomerReferralRewardQueue({ take, skip, q, status, reward, fraud, range });
  }

  @Get('referrals/customers/workspace')
  customerReferralWorkspace(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.customerReferralWorkspace({ take, skip, q, status, reward, fraud, range });
  }

  @Get('referrals/customers/fixtures')
  customerReferralFixtures(
    @Query('include') include?: string,
    @Query('take') take?: string,
  ) {
    return include === 'confirmed' ? this.admin.listCustomerReferralFixtureRewards({ take }) : [];
  }

  @Get('referrals/customers/:id')
  customerReferralParent(@Param('id') customerProfileId: string) {
    return this.admin.getCustomerReferralParent(customerProfileId);
  }

  @Get('referrals/partners')
  partnerReferralParents(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.listPartnerReferralParents({ take, skip, q, status, reward, fraud, range });
  }

  @Get('referrals/partners/summary')
  partnerReferralParentSummary(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
    @Query('fraud') fraud?: string,
    @Query('range') range?: string,
  ) {
    return this.admin.partnerReferralParentSummary({ q, status, reward, fraud, range });
  }

  @Get('referrals/partners/:id')
  partnerReferralParent(@Param('id') providerProfileId: string) {
    return this.admin.getPartnerReferralParent(providerProfileId);
  }
}
