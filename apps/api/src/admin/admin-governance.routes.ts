import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateOperationsShiftHandoffDto,
  OperationsHandoffNoteDto,
  UpdateOperationalPolicyDto,
} from './admin.dto';
import { AdminCouponRoutes } from './admin-coupon.routes';

export class AdminGovernanceRoutes extends AdminCouponRoutes {
  @Get('audit-logs')
  auditLogs(
    @Query('action') action?: string | string[],
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('bucket') bucket?: string,
    @Query('priority') priority?: string,
    @Query('withTotal') withTotal?: string,
  ) {
    const options = { action, bucket, from, priority, q, skip, take, to };
    return withTotal === 'true' ? this.admin.listAuditLogPage(options) : this.admin.listAuditLogs(options);
  }

  @Get('audit-logs/summary')
  auditLogSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('bucket') bucket?: string,
    @Query('priority') priority?: string,
    @Query('action') action?: string | string[],
  ) {
    return this.admin.auditLogSummary({ action, bucket, from, priority, q, to });
  }

  @Get('operations-handoff/activity')
  operationsHandoffActivity(
    @Query('range') range?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('review') review?: string,
    @Query('backlog') backlog?: string,
    @Query('source') source?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
    @Query('reason') reason?: string,
  ) {
    return this.admin.operationsHandoffActivityPage({
      age,
      backlog,
      page,
      pageSize,
      range,
      reason,
      review,
      sort,
      source,
    });
  }

  @Post('operations-handoff/note')
  addOperationsHandoffNote(@CurrentUser() user: AuthenticatedUser, @Body() body: OperationsHandoffNoteDto) {
    return this.admin.addOperationsHandoffNote(user.id, body);
  }

  @Get('operations-handoff/open-cases')
  operationsHandoffOpenCases(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('queue') queue?: string,
    @Query('age') age?: string,
  ) {
    return this.admin.listOperationsHandoffOpenCases({ actorId: user.id, age, page, pageSize, q, queue });
  }

  @Get('operations-handoff/operators')
  operationsHandoffOperators(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listOperationsHandoffOperators(user.id);
  }

  @Get('operations-handoff/shift')
  operationsShiftHandoffs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('range') range?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('operator') operator?: string,
    @Query('q') q?: string,
    @Query('scope') scope?: string,
    @Query('relationship') relationship?: string,
  ) {
    return this.admin.listOperationsShiftHandoffs({
      actorId: user.id,
      operator,
      page,
      pageSize,
      q,
      range,
      relationship,
      scope,
      status,
    });
  }

  @Post('operations-handoff/shift')
  createOperationsShiftHandoff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOperationsShiftHandoffDto,
  ) {
    return this.admin.createOperationsShiftHandoff(user.id, body);
  }

  @Post('operations-handoff/shift/:id/acknowledge')
  acknowledgeOperationsShiftHandoff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.acknowledgeOperationsShiftHandoff(user.id, id);
  }

  @Get('operational-policy')
  operationalPolicy(@Query('keys') keys?: string | string[]) {
    return this.admin.listOperationalPolicySettings({ keys });
  }

  @Patch('operational-policy/:key')
  updateOperationalPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: UpdateOperationalPolicyDto,
  ) {
    return this.admin.updateOperationalPolicySetting(user.id, key, body);
  }
}
