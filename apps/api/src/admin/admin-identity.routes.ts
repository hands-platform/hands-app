import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AdminCalendarActorDto,
  AdminOperatorActivityDto,
  CreateAdminCalendarEventDto,
  CreateAdminOperatorDto,
  DeleteAdminOperatorAccessDto,
  UpdateAdminCalendarEventDto,
  UpdateAdminOperatorAccessDto,
  UpdateFinanceApproverRoleDto,
  VerifyAdminOperatorLoginDto,
} from './admin.dto';
import { AdminNotificationRoutes } from './admin-notification.routes';

export class AdminIdentityRoutes extends AdminNotificationRoutes {
  @Get('users')
  users(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('role') role?: string,
    @Query('view') view?: string,
  ) {
    return this.admin.listUsers({ role, skip, take, view });
  }

  @Get('users/admin-operator-access')
  adminOperatorAccess(@CurrentUser() user: AuthenticatedUser, @Query('identity') identity?: string) {
    return this.admin.getAdminOperatorAccess(user.id, identity);
  }

  @Post('users/admin-operators')
  createAdminOperator(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAdminOperatorDto) {
    return this.admin.createAdminOperator(user.id, body);
  }

  @Post('users/admin-operator-login')
  verifyAdminOperatorLogin(@Body() body: VerifyAdminOperatorLoginDto) {
    return this.admin.verifyAdminOperatorLogin(body);
  }

  @Patch('users/:id/admin-operator-access')
  updateAdminOperatorAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: UpdateAdminOperatorAccessDto,
  ) {
    return this.admin.updateAdminOperatorAccess(user.id, userId, body);
  }

  @Delete('users/:id/admin-operator')
  revokeAdminOperatorAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: DeleteAdminOperatorAccessDto,
  ) {
    return this.admin.revokeAdminOperatorAccess(user.id, userId, body);
  }

  @Post('operator-activity')
  recordAdminOperatorActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminOperatorActivityDto,
  ) {
    return this.admin.recordAdminOperatorActivity(user.id, body);
  }

  @Get('calendar-events')
  calendarEvents(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listAdminCalendarEvents({ from, skip, take, to });
  }

  @Post('calendar-events')
  createCalendarEvent(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAdminCalendarEventDto) {
    return this.admin.createAdminCalendarEvent(user.id, body);
  }

  @Patch('calendar-events/:id')
  updateCalendarEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAdminCalendarEventDto,
  ) {
    return this.admin.updateAdminCalendarEvent(user.id, id, body);
  }

  @Delete('calendar-events/:id')
  deleteCalendarEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AdminCalendarActorDto = {},
  ) {
    return this.admin.deleteAdminCalendarEvent(user.id, id, body);
  }

  @Patch('users/:id/finance-approver')
  updateUserFinanceApproverRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: UpdateFinanceApproverRoleDto,
  ) {
    return this.admin.updateUserFinanceApproverRole(user.id, userId, body);
  }

  @Get('app-sessions')
  appSessions(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('role') role?: string,
    @Query('state') state?: string,
    @Query('platform') platform?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listAppSessions({ platform, q, role, skip, state, take });
  }

  @Get('app-sessions/summary')
  appSessionSummary(
    @Query('role') role?: string,
    @Query('state') state?: string,
    @Query('platform') platform?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.appSessionSummary({ platform, q, role, state });
  }
}
