import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClaimReferralCodeDto, ReferralListQueryDto } from './referrals.dto';
import { ReferralsService } from './referrals.service';

@Controller()
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('customer/referral-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerReferralCode(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getCustomerReferralCode(user.id);
  }

  @Get('customer/referrals/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerReferralSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getCustomerReferralSummary(user.id);
  }

  @Get('customer/referrals/invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerReferralInvites(@CurrentUser() user: AuthenticatedUser, @Query() query: ReferralListQueryDto) {
    return this.referrals.listCustomerReferralInvites(user.id, query);
  }

  @Get('customer/referrals/rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerReferralRewards(@CurrentUser() user: AuthenticatedUser, @Query() query: ReferralListQueryDto) {
    return this.referrals.listCustomerReferralRewards(user.id, query);
  }

  @Post('customer/referral-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  issueCustomerReferralCode(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.issueCustomerReferralCode(user.id);
  }

  @Post('customer/referrals/claim')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  claimCustomerReferralCode(@CurrentUser() user: AuthenticatedUser, @Body() body: ClaimReferralCodeDto) {
    return this.referrals.claimCustomerReferralCode(user.id, body);
  }

  @Post('customer/referrals/rewards/:rewardId/cashout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  requestCustomerReferralCashout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rewardId') rewardId: string,
  ) {
    return this.referrals.requestCustomerRewardCashout(user.id, rewardId);
  }

  @Get(['partner/referral-code', 'provider/referral-code'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  partnerReferralCode(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getPartnerReferralCode(user.id);
  }

  @Get(['partner/referrals/summary', 'provider/referrals/summary'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  partnerReferralSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getPartnerReferralSummary(user.id);
  }

  @Post(['partner/referral-code', 'provider/referral-code'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  issuePartnerReferralCode(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.issuePartnerReferralCode(user.id);
  }

  @Post(['partner/referrals/claim', 'provider/referrals/claim'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  claimPartnerReferralCode(@CurrentUser() user: AuthenticatedUser, @Body() body: ClaimReferralCodeDto) {
    return this.referrals.claimPartnerReferralCode(user.id, body);
  }

  @Post(['partner/referrals/rewards/:rewardId/cashout', 'provider/referrals/rewards/:rewardId/cashout'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  requestPartnerReferralCashout(@CurrentUser() user: AuthenticatedUser, @Param('rewardId') rewardId: string) {
    return this.referrals.requestPartnerRewardCashout(user.id, rewardId);
  }
}
