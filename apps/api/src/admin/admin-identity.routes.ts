import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AdminCalendarActorDto,
  BeginAdminMfaEnrollmentDto,
  AdminOperatorActivityDto,
  CreateAdminCalendarEventDto,
  CreateAdminOperatorInvitationDto,
  CreateFinanceApproverAccessRequestDto,
  CreateFinanceApproverLegacyAttestationDto,
  DecideFinanceApproverAccessRequestDto,
  DecideFinanceApproverLegacyAttestationDto,
  DeleteAdminOperatorAccessDto,
  InitializeAdminOperatorPermissionDto,
  ManageAdminOperatorInvitationDto,
  ReauthenticateAdminOperatorDto,
  ResetAdminMfaDto,
  RevokeFinanceApproverLegacyAttestationDto,
  SuspendAdminOperatorDto,
  UpdateAdminCalendarEventDto,
  UpdateAdminOperatorAccessDto,
  VerifyAdminMfaEnrollmentDto,
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

  @Get('users/admin-operators')
  adminOperators(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeTestRecords') includeTestRecords?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listAdminOperators({ category, cursor, includeTestRecords, q, role, status, take }, user.id);
  }

  @Get('users/admin-operators/:id')
  adminOperatorDirectoryItem(@CurrentUser() user: AuthenticatedUser, @Param('id') userId: string) {
    return this.admin.getAdminOperatorDirectoryItem(user.id, userId);
  }

  @Get('admin-operator-invitations')
  adminOperatorInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listAdminOperatorInvitations(user.id);
  }

  @Get('admin-operator-invitations/existing-user-candidate')
  adminOperatorExistingUserCandidate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('email') email?: string,
  ) {
    return this.admin.findAdminOperatorInvitationCandidate(user.id, email);
  }

  @Post('admin-operator-invitations')
  createAdminOperatorInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAdminOperatorInvitationDto,
  ) {
    return this.admin.createAdminOperatorInvitation(user.id, user.sessionId, body);
  }

  @Post('admin-operator-invitations/:id/revoke')
  revokeAdminOperatorInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invitationId: string,
    @Body() body: ManageAdminOperatorInvitationDto,
  ) {
    return this.admin.revokeAdminOperatorInvitation(user.id, user.sessionId, invitationId, body);
  }

  @Post('admin-operator-invitations/:id/resend')
  resendAdminOperatorInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invitationId: string,
    @Body() body: ManageAdminOperatorInvitationDto,
  ) {
    return this.admin.resendAdminOperatorInvitation(user.id, user.sessionId, invitationId, body);
  }

  @Post('admin-operators/reauthenticate')
  reauthenticateAdminOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReauthenticateAdminOperatorDto,
  ) {
    return this.admin.reauthenticateAdminOperator(user.id, user.sessionId, body);
  }

  @Post('admin-operators/me/mfa/enrollment')
  beginCurrentAdminMfaEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BeginAdminMfaEnrollmentDto,
  ) {
    return this.admin.beginAdminMfaEnrollment(user.id, user.sessionId, body);
  }

  @Get('admin-operators/me/mfa')
  currentAdminMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getAdminMfaStatus(user.id);
  }

  @Post('admin-operators/me/mfa/verify')
  verifyCurrentAdminMfaEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: VerifyAdminMfaEnrollmentDto,
  ) {
    return this.admin.verifyAdminMfaEnrollment(user.id, user.sessionId, body);
  }

  @Post('users/:id/admin-operator/mfa/reset')
  resetAdminMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: ResetAdminMfaDto,
  ) {
    return this.admin.resetAdminMfa(user.id, user.sessionId, userId, body);
  }

  @Get('admin-operators/me/session')
  currentAdminOperatorSession(@CurrentUser() user: AuthenticatedUser) {
    return {
      ok: true,
      sessionId: user.sessionId,
      mfaEnrollmentRequired: user.adminMfaEnrollmentRequired === true,
      operatorAccess: {
        id: user.id,
        roles: user.roles,
        categories: user.adminPermissionCategories ?? [],
      },
    };
  }

  @Post('admin-operators/me/session/revoke')
  revokeCurrentAdminOperatorSession(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.revokeCurrentAdminOperatorSession(user.id, user.sessionId);
  }

  @Patch('users/:id/admin-operator-access')
  updateAdminOperatorAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: UpdateAdminOperatorAccessDto,
  ) {
    return this.admin.updateAdminOperatorAccess(user.id, userId, body, user.sessionId);
  }

  @Post('users/:id/admin-operator-access/initialize')
  initializeAdminOperatorPermission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: InitializeAdminOperatorPermissionDto,
  ) {
    return this.admin.initializeAdminOperatorPermission(user.id, userId, body, user.sessionId);
  }

  @Post('users/:id/admin-operator/suspend')
  suspendAdminOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: SuspendAdminOperatorDto,
  ) {
    return this.admin.setAdminOperatorSuspended(user.id, user.sessionId, userId, true, body);
  }

  @Post('users/:id/admin-operator/reactivate')
  reactivateAdminOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: SuspendAdminOperatorDto,
  ) {
    return this.admin.setAdminOperatorSuspended(user.id, user.sessionId, userId, false, body);
  }

  @Get('users/:id/admin-web-sessions')
  adminOperatorSessions(@CurrentUser() user: AuthenticatedUser, @Param('id') userId: string) {
    return this.admin.listAdminOperatorSessions(user.id, userId, user.sessionId);
  }

  @Get('admin-operator-history')
  adminOperatorHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('targetUserId') targetUserId?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.admin.listAdminOperatorHistory(user.id, targetUserId, take, cursor);
  }

  @Post('users/:id/admin-web-sessions/:sessionId/revoke')
  revokeAdminOperatorSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: SuspendAdminOperatorDto,
  ) {
    return this.admin.revokeAdminOperatorSession(user.id, user.sessionId, userId, sessionId, body);
  }

  @Delete('users/:id/admin-operator')
  revokeAdminOperatorAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() body: DeleteAdminOperatorAccessDto,
  ) {
    return this.admin.revokeAdminOperatorAccess(user.id, userId, body, user.sessionId);
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
    @Query('range') range?: string,
  ) {
    return this.admin.listAdminCalendarEvents({
      from,
      skip,
      take,
      to,
      ...(range === 'bounded' ? { boundedRange: true } : {}),
    });
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

  @Get('finance-approver-governance/summary')
  financeApproverGovernanceSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getFinanceApproverGovernanceSummary(user.id);
  }

  @Get('finance-approver-governance/operators')
  financeApproverGovernanceOperators(
    @CurrentUser() user: AuthenticatedUser,
    @Query('access') access?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('readiness') readiness?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listFinanceApproverGovernanceOperators(user.id, { access, q, readiness, skip, status, take });
  }

  @Get('finance-approver-governance/requests')
  financeApproverGovernanceRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('source') source?: string,
  ) {
    return this.admin.listFinanceApproverAccessRequests(user.id, { q, skip, source, status, take });
  }

  @Get('finance-approver-governance/history')
  financeApproverGovernanceHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('targetUserId') targetUserId?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('source') source?: string,
  ) {
    return this.admin.listFinanceApproverAccessHistory(user.id, { q, skip, source, take, targetUserId });
  }

  @Post('finance-approver-governance/requests')
  createFinanceApproverAccessRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFinanceApproverAccessRequestDto,
  ) {
    return this.admin.createFinanceApproverAccessRequest(user.id, body);
  }

  @Post('finance-approver-governance/requests/:id/decision')
  decideFinanceApproverAccessRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Body() body: DecideFinanceApproverAccessRequestDto,
  ) {
    return this.admin.decideFinanceApproverAccessRequest(user.id, requestId, body, user.sessionId);
  }

  @Post('finance-approver-governance/legacy-attestations')
  createFinanceApproverLegacyAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFinanceApproverLegacyAttestationDto,
  ) {
    return this.admin.createFinanceApproverLegacyAttestation(user.id, body);
  }

  @Post('finance-approver-governance/legacy-attestations/:id/decision')
  decideFinanceApproverLegacyAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestEventId: string,
    @Body() body: DecideFinanceApproverLegacyAttestationDto,
  ) {
    return this.admin.decideFinanceApproverLegacyAttestation(
      user.id,
      requestEventId,
      body,
      user.sessionId,
    );
  }

  @Post('finance-approver-governance/legacy-attestations/:id/revoke')
  revokeFinanceApproverLegacyAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') attestationEventId: string,
    @Body() body: RevokeFinanceApproverLegacyAttestationDto,
  ) {
    return this.admin.revokeFinanceApproverLegacyAttestation(
      user.id,
      attestationEventId,
      body,
      user.sessionId,
    );
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
