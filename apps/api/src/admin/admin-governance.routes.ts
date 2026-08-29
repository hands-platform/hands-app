import { Body, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { assertShiftHandoffLaunchEnabled } from '../common/launch-features';
import {
  AdminAuditCorrectionDto,
  CreateOperationsShiftHandoffDto,
  OperationsHandoffNoteDto,
  UpdateOperationalPolicyDto,
} from './admin.dto';
import { AdminCouponRoutes } from './admin-coupon.routes';
import { operationalPolicyAuditContextFromHeaders } from './admin-operational-policy-audit-source';

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
    @Query('targetPrefix') targetPrefix?: string,
  ) {
    const options = { action, bucket, from, priority, q, skip, take, targetPrefix, to };
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
    @Query('targetPrefix') targetPrefix?: string,
  ) {
    return this.admin.auditLogSummary({ action, bucket, from, priority, q, targetPrefix, to });
  }

  @Get('audit-logs/page')
  auditLogWorkspacePage(
    @Query('view') view?: string,
    @Query('range') range?: string,
    @Query('q') q?: string,
    @Query('area') area?: string,
    @Query('outcome') outcome?: string,
    @Query('severity') severity?: string,
    @Query('actorType') actorType?: string,
    @Query('objectType') objectType?: string,
    @Query('eventId') eventId?: string,
    @Query('correlationId') correlationId?: string,
    @Query('requestId') requestId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('action') action?: string | string[],
    @Query('bucket') bucket?: string,
    @Query('priority') priority?: string,
    @Query('targetPrefix') targetPrefix?: string,
  ) {
    return this.admin.auditLogWorkspacePage({
      action,
      actorType,
      area,
      bucket,
      correlationId,
      cursor,
      eventId,
      from,
      objectType,
      outcome,
      priority,
      q,
      range,
      requestId,
      severity,
      sort,
      take,
      targetPrefix,
      to,
      view,
    });
  }

  @Get('audit-logs/events/:id')
  auditLogEventDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('bucket') bucket?: string,
  ) {
    return this.admin.auditLogEventDetail(user.id, id, bucket);
  }

  @Post('audit-logs/events/:id/corrections')
  recordAuditLogCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AdminAuditCorrectionDto,
  ) {
    return this.admin.recordAuditCorrection(user.id, id, body.reason);
  }

  @Get('audit-logs/export')
  auditLogExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format?: string,
    @Query('view') view?: string,
    @Query('range') range?: string,
    @Query('q') q?: string,
    @Query('area') area?: string,
    @Query('outcome') outcome?: string,
    @Query('severity') severity?: string,
    @Query('actorType') actorType?: string,
    @Query('objectType') objectType?: string,
    @Query('eventId') eventId?: string,
    @Query('correlationId') correlationId?: string,
    @Query('requestId') requestId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('targetPrefix') targetPrefix?: string,
    @Query('bucket') bucket?: string,
  ) {
    return this.admin.exportAuditLogs(
      user.id,
      {
        actorType,
        area,
        bucket,
        correlationId,
        eventId,
        from,
        objectType,
        outcome,
        q,
        range,
        requestId,
        severity,
        sort,
        targetPrefix,
        to,
        view,
      },
      format,
    );
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
    assertShiftHandoffLaunchEnabled();
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
    assertShiftHandoffLaunchEnabled();
    return this.admin.createOperationsShiftHandoff(user.id, body);
  }

  @Post('operations-handoff/shift/:id/acknowledge')
  acknowledgeOperationsShiftHandoff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    assertShiftHandoffLaunchEnabled();
    return this.admin.acknowledgeOperationsShiftHandoff(user.id, id);
  }

  @Get('operational-policy')
  operationalPolicy(@Query('keys') keys?: string | string[]) {
    return this.admin.listOperationalPolicySettings({ keys });
  }

  @Get('operational-policy/audit')
  operationalPolicyAudit(
    @Query('source') source?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listOperationalPolicyAudit({ cursor, source, take });
  }

  @Patch('operational-policy/:key')
  updateOperationalPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: UpdateOperationalPolicyDto,
    @Headers() headers: Record<string, string | string[] | undefined> = {},
  ) {
    return this.admin.updateOperationalPolicySetting(
      user.id,
      key,
      body,
      operationalPolicyAuditContextFromHeaders(headers),
    );
  }
}
