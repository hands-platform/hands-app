import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AdminPushCampaignDto,
  AdminReasonDto,
  UpdateNotificationTemplateDto,
} from './admin.dto';
import { AdminGovernanceRoutes } from './admin-governance.routes';

export class AdminNotificationRoutes extends AdminGovernanceRoutes {
  @Get('notifications')
  notifications(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('review') review?: string,
    @Query('booking') booking?: string,
    @Query('user') user?: string,
    @Query('incidentState') incidentState?: string,
    @Query('financeAge') financeAge?: string,
    @Query('financeOwner') financeOwner?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
    @Query('recipientRole') recipientRole?: string,
    @Query('channel') channel?: string,
    @Query('scope') scope?: string,
    @Query('failureProvider') failureProvider?: string,
    @Query('failureCode') failureCode?: string,
    @Query('dataScope') dataScope?: string,
  ) {
    return this.admin.listNotifications({
      ...(age ? { age } : {}),
      booking,
      financeAge,
      financeOwner,
      from,
      incidentState,
      review,
      sla,
      skip,
      ...(sort ? { sort } : {}),
      take,
      to,
      user,
      q,
      recipientRole,
      channel,
      scope,
      failureProvider,
      failureCode,
      dataScope,
    });
  }

  @Get('notifications/summary')
  notificationSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('review') review?: string,
    @Query('booking') booking?: string,
    @Query('user') user?: string,
    @Query('incidentState') incidentState?: string,
    @Query('financeAge') financeAge?: string,
    @Query('financeOwner') financeOwner?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
    @Query('recipientRole') recipientRole?: string,
    @Query('channel') channel?: string,
    @Query('scope') scope?: string,
    @Query('failureProvider') failureProvider?: string,
    @Query('failureCode') failureCode?: string,
    @Query('dataScope') dataScope?: string,
    @Query('viewMode') viewMode?: string,
  ) {
    return this.admin.notificationSummary({
      ...(age ? { age } : {}),
      booking,
      financeAge,
      financeOwner,
      from,
      incidentState,
      review,
      sla,
      to,
      user,
      q,
      recipientRole,
      channel,
      scope,
      failureProvider,
      failureCode,
      dataScope,
      viewMode,
    });
  }

  @Get('notifications/templates')
  notificationTemplates(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listNotificationTemplates({ skip, take });
  }

  @Patch('notifications/templates/:key')
  updateNotificationTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.admin.updateNotificationTemplate(user.id, key, body);
  }

  @Get('notifications/push-campaigns')
  pushCampaigns(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.listAdminPushCampaigns({ from, skip, take, to });
  }

  @Get('notifications/push-campaigns/summary')
  pushCampaignSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.adminPushCampaignSummary({ from, to });
  }

  @Post('notifications/push-campaigns/preview')
  previewPushCampaign(@Body() body: AdminPushCampaignDto) {
    return this.admin.previewAdminPushCampaign(body);
  }

  @Post('notifications/push-campaigns')
  createPushCampaign(@CurrentUser() user: AuthenticatedUser, @Body() body: AdminPushCampaignDto) {
    return this.admin.createAdminPushCampaign(user.id, body);
  }

  @Post('notifications/:id/retry')
  retryNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.retryNotification(user.id, id, body.reason);
  }

  @Post('notifications/:id/review-legacy')
  reviewLegacyNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.reviewLegacyNotification(user.id, id, body.reason);
  }
}
