import { Body, Get, Param, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpsertMarketingSpendDailyDto } from './admin.dto';
import { AdminIdentityRoutes } from './admin-identity.routes';

export class AdminAnalyticsRoutes extends AdminIdentityRoutes {
  @Get('dashboard/summary')
  dashboardSummary(@Query('dateRange') dateRange?: string) {
    return this.admin.dashboardSummary(dateRange);
  }

  @Get('dashboard/start-shift-summary')
  startShiftSummary(@Query('dateRange') dateRange?: string) {
    return this.admin.startShiftSummary(dateRange);
  }

  @Get(['vietnam-overview', 'maps/vietnam-overview'])
  vietnamOverview(@Query('range') range?: string) {
    return this.admin.getVietnamOverview(range);
  }

  @Get(['vietnam-overview/summary', 'maps/vietnam-overview/summary'])
  vietnamOverviewSummary(@Query('range') range?: string) {
    return this.admin.getVietnamOverviewSummary(range);
  }

  @Get(['vietnam-overview/realtime-points', 'maps/vietnam-overview/realtime-points'])
  vietnamOverviewRealtimePoints(@Query('range') range?: string, @Query('take') take?: string) {
    return this.admin.getVietnamOverviewRealtimePoints(range, { take });
  }

  @Get('usage-overview')
  usageOverview(@Query('range') range?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.getUsageOverview({ from, range, to });
  }

  @Get('partners/overview')
  partnerOverview(
    @Query('range') range?: string,
    @Query('city') city?: string,
    @Query('serviceId') serviceId?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('onlineStatus') onlineStatus?: string,
    @Query('walletStatus') walletStatus?: string,
    @Query('riskStatus') riskStatus?: string,
    @Query('selectionIssue') selectionIssue?: string,
    @Query('selectionSort') selectionSort?: string,
    @Query('includeActionRows') includeActionRows?: string,
    @Query('previewLimit') previewLimit?: string,
  ) {
    return this.admin.getPartnerOverview({
      city,
      ...(includeActionRows === undefined ? {} : { includeActionRows: includeActionRows !== 'false' }),
      onlineStatus,
      ...(previewLimit === undefined ? {} : { previewLimit }),
      range,
      riskStatus,
      selectionIssue,
      selectionSort,
      serviceId,
      verificationStatus,
      walletStatus,
    });
  }

  @Get('marketing/overview')
  marketingOverview(
    @Query('range') range?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('regionCode') regionCode?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.admin.getMarketingOverview({
      range,
      source,
      platform,
      regionCode,
      campaignId,
    });
  }

  @Get('marketing/summary')
  marketingSummary(
    @Query('range') range?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('regionCode') regionCode?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.admin.getMarketingSummary({
      range,
      source,
      platform,
      regionCode,
      campaignId,
    });
  }

  @Get('marketing/coupons/summary')
  marketingCouponSummary(@Query('range') range?: string) {
    return this.admin.getMarketingCouponSummary({ range });
  }

  @Get('marketing/coupons')
  marketingCouponPerformance(
    @Query('range') range?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listMarketingCouponPerformance({ range, skip, take });
  }

  @Get('marketing/dimensions/:dimension')
  marketingDimension(
    @Param('dimension') dimension: string,
    @Query('range') range?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('regionCode') regionCode?: string,
    @Query('campaignId') campaignId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listMarketingDimensionRows({
      dimension,
      range,
      source,
      platform,
      regionCode,
      campaignId,
      take,
      skip,
    });
  }

  @Post('marketing/spend-daily')
  upsertMarketingSpendDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertMarketingSpendDailyDto,
  ) {
    return this.admin.upsertMarketingSpendDaily(user.id, body);
  }

  @Get('marketing/spend-daily')
  marketingSpendDaily(
    @Query('spendDate') spendDate?: string,
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('regionCode') regionCode?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.admin.getMarketingSpendDaily({
      campaignId,
      platform,
      regionCode,
      source,
      spendDate,
    });
  }
}
