import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FileReviewStatus, VerificationStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminCustomerRoutes } from './admin-customer.routes';
import {
  AdminReasonDto,
  CompletePartnerPublicMediaUploadDto,
  CreatePartnerPublicMediaUploadDto,
  CreatePartnerReportDto,
  CreatePartnerSanctionDto,
  LiftPartnerSanctionDto,
  PartnerOpsNoteDto,
  ReorderPartnerPublicMediaDto,
  UpdatePartnerProfileContentDto,
  UpdatePartnerReportDto,
} from './admin.dto';

export class AdminPartnerRoutes extends AdminCustomerRoutes {
  @Get(['providers', 'partners'])
  providers() {
    return this.admin.listProviders();
  }

  @Get('operations-policy/providers')
  operationsPolicyProviders(@Query('take') take?: string) {
    return this.admin.listOperationsPolicyProviders({ take });
  }

  @Get('operations-policy/matching-preview')
  operationsPolicyMatchingPreview(@Query('referenceBookingId') referenceBookingId?: string) {
    return this.admin.matchingPreview(referenceBookingId);
  }

  @Get('operations-handoff/providers')
  operationsHandoffProviders(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('review') review?: string,
    @Query('withTotal') withTotal?: string,
  ) {
    return this.admin.listOperationsHandoffProviders({ review, skip, take, withTotal });
  }

  @Get('partner-controls/providers')
  partnerControlProviders(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('review') review?: string,
    @Query('sort') sort?: string,
    @Query('withTotal') withTotal?: string,
  ) {
    return this.admin.listPartnerControlProviders({ q, review, skip, sort, take, withTotal });
  }

  @Get('partner-controls/summary')
  partnerControlSummary() {
    return this.admin.partnerControlSummary();
  }

  @Get('partners/list-providers')
  partnerDirectoryProviders(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('review') review?: string,
    @Query('verification') verification?: string,
    @Query('providerStatus') providerStatus?: string,
    @Query('kyc') kyc?: string,
    @Query('bookingFlow') bookingFlow?: string,
    @Query('sort') sort?: string,
    @Query('activity') activity?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('qualityRange') qualityRange?: string,
    @Query('approvalMissing') approvalMissing?: string,
    @Query('approvalRisk') approvalRisk?: string,
    @Query('city') city?: string,
    @Query('serviceId') serviceId?: string,
    @Query('walletStatus') walletStatus?: string,
  ) {
    return this.admin.listPartnerDirectoryProviders({
      ...(age ? { age } : {}),
      activity,
      ...(approvalMissing ? { approvalMissing } : {}),
      ...(approvalRisk ? { approvalRisk } : {}),
      bookingFlow,
      ...(city ? { city } : {}),
      kyc,
      providerStatus,
      q,
      ...(qualityRange ? { qualityRange } : {}),
      review,
      ...(serviceId ? { serviceId } : {}),
      sla,
      skip,
      sort,
      take,
      verification,
      ...(walletStatus ? { walletStatus } : {}),
    });
  }

  @Get('partners/list-providers/summary')
  partnerDirectorySummary(
    @Query('q') q?: string,
    @Query('review') review?: string,
    @Query('verification') verification?: string,
    @Query('providerStatus') providerStatus?: string,
    @Query('kyc') kyc?: string,
    @Query('bookingFlow') bookingFlow?: string,
    @Query('activity') activity?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('qualityRange') qualityRange?: string,
    @Query('approvalMissing') approvalMissing?: string,
    @Query('approvalRisk') approvalRisk?: string,
    @Query('city') city?: string,
    @Query('serviceId') serviceId?: string,
    @Query('walletStatus') walletStatus?: string,
  ) {
    return this.admin.partnerDirectorySummary({
      ...(age ? { age } : {}),
      activity,
      ...(approvalMissing ? { approvalMissing } : {}),
      ...(approvalRisk ? { approvalRisk } : {}),
      bookingFlow,
      ...(city ? { city } : {}),
      kyc,
      providerStatus,
      q,
      ...(qualityRange ? { qualityRange } : {}),
      review,
      ...(serviceId ? { serviceId } : {}),
      sla,
      verification,
      ...(walletStatus ? { walletStatus } : {}),
    });
  }

  @Get('partners/wallet-debt-page')
  partnerWalletDebtCursorPage(
    @Query('cursor') cursor?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.partnerWalletDebtCursorPage({ cursor, q, take });
  }

  @Get(['providers/:id/overview', 'partners/:id/overview'])
  providerOverview(@Param('id') providerProfileId: string) {
    return this.admin.getProviderOverview(providerProfileId);
  }

  @Get(['providers/:id', 'partners/:id'])
  providerDetail(
    @Param('id') providerProfileId: string,
    @Query('includeDiagnostics') includeDiagnostics?: string,
    @Query('view') view?: string,
  ) {
    return this.admin.getProviderDetail(providerProfileId, {
      includeDiagnostics: includeDiagnostics !== 'false',
      ...(view === 'finance' || view === 'evidence' ? { view } : {}),
    });
  }

  @Post(['providers/:id/ops-note', 'partners/:id/ops-note'])
  addProviderOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: PartnerOpsNoteDto,
  ) {
    return this.admin.addProviderOpsNote(user.id, providerProfileId, body);
  }

  @Post('push-devices/:id/enable')
  enablePushDevice(@Param('id') pushDeviceId: string) {
    return this.admin.enablePushDevice(pushDeviceId);
  }

  @Post(['provider-devices/:id/block', 'partner-devices/:id/block'])
  blockProviderDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerDeviceId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.blockProviderDevice(user.id, providerDeviceId, body.reason);
  }

  @Post(['provider-devices/:id/unblock', 'partner-devices/:id/unblock'])
  unblockProviderDevice(@CurrentUser() user: AuthenticatedUser, @Param('id') providerDeviceId: string) {
    return this.admin.unblockProviderDevice(user.id, providerDeviceId);
  }

  @Post(['providers/:id/approve', 'partners/:id/approve'])
  approveProvider(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.APPROVED);
  }

  @Post(['providers/:id/block', 'partners/:id/block'])
  blockProviderAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.blockProviderAccount(user.id, providerProfileId, body.reason);
  }

  @Post(['providers/:id/unblock', 'partners/:id/unblock'])
  unblockProviderAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: LiftPartnerSanctionDto,
  ) {
    return this.admin.unblockProviderAccount(user.id, providerProfileId, body);
  }

  @Get(['provider-reports', 'partner-reports'])
  providerReports(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('review') review?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('sort') sort?: string,
    @Query('withTotal') withTotal?: string,
  ) {
    return this.admin.listProviderReports({ q, review, severity, skip, sort, status, take, withTotal });
  }

  @Post(['provider-reports', 'partner-reports'])
  createProviderReport(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePartnerReportDto) {
    return this.admin.createProviderReport(user.id, body);
  }

  @Get(['provider-reports/:id', 'partner-reports/:id'])
  providerReport(@Param('id') reportId: string) {
    return this.admin.getProviderReport(reportId);
  }

  @Get(['provider-reports/:id/audit-history', 'partner-reports/:id/audit-history'])
  providerReportAuditHistory(@Param('id') reportId: string) {
    return this.admin.getProviderReportAuditHistory(reportId);
  }

  @Patch(['provider-reports/:id', 'partner-reports/:id'])
  updateProviderReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
    @Body() body: UpdatePartnerReportDto,
  ) {
    return this.admin.updateProviderReport(user.id, reportId, body);
  }

  @Get(['provider-sanctions', 'partner-sanctions'])
  providerSanctions(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('withTotal') withTotal?: string,
  ) {
    return this.admin.listProviderSanctions({ q, skip, sort, status, take, type, withTotal });
  }

  @Post(['providers/:id/sanctions', 'partners/:id/sanctions'])
  createProviderSanction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: CreatePartnerSanctionDto,
  ) {
    return this.admin.createProviderSanction(user.id, providerProfileId, body);
  }

  @Post(['provider-sanctions/:id/lift', 'partner-sanctions/:id/lift'])
  liftProviderSanction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sanctionId: string,
    @Body() body: LiftPartnerSanctionDto,
  ) {
    return this.admin.liftProviderSanction(user.id, sanctionId, body);
  }

  @Post(['providers/:id/sync-supabase-role', 'partners/:id/sync-supabase-role'])
  syncProviderSupabaseRole(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.syncProviderSupabaseRole(user.id, providerProfileId);
  }

  @Patch(['providers/:id/profile-content', 'partners/:id/profile-content'])
  updatePartnerProfileContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: UpdatePartnerProfileContentDto,
  ) {
    return this.admin.updatePartnerProfileContent(user.id, providerProfileId, body);
  }

  @Post(['providers/:id/public-media/presign', 'partners/:id/public-media/presign'])
  createPartnerPublicMediaUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: CreatePartnerPublicMediaUploadDto,
  ) {
    return this.admin.createPartnerPublicMediaUpload(user, providerProfileId, body);
  }

  @Post(['providers/:id/public-media/:fileId/complete', 'partners/:id/public-media/:fileId/complete'])
  completePartnerPublicMediaUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Param('fileId') fileId: string,
    @Body() body: CompletePartnerPublicMediaUploadDto,
  ) {
    return this.admin.completePartnerPublicMediaUpload(user, providerProfileId, fileId, body);
  }

  @Patch(['providers/:id/public-media/order', 'partners/:id/public-media/order'])
  reorderPartnerPublicMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ReorderPartnerPublicMediaDto,
  ) {
    return this.admin.reorderPartnerPublicMedia(user.id, providerProfileId, body);
  }

  @Delete(['providers/:id/public-media/:fileId', 'partners/:id/public-media/:fileId'])
  deletePartnerPublicMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.admin.deletePartnerPublicMedia(user, providerProfileId, fileId);
  }

  @Get('files/review-providers')
  fileReviewProviders(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listFileReviewProviders({ skip, take });
  }

  @Get('files/review-items')
  fileReviewItems(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listFileReviewItems({ kind, q, review, skip, take });
  }

  @Get('files/review-summary')
  fileReviewSummary() {
    return this.admin.fileReviewSummary();
  }

  @Post('files/:id/approve-public-media')
  approvePublicProviderMedia(@CurrentUser() user: AuthenticatedUser, @Param('id') fileId: string) {
    return this.admin.reviewPublicProviderMedia(user.id, fileId, FileReviewStatus.APPROVED);
  }

  @Post('files/:id/reject-public-media')
  rejectPublicProviderMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') fileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.reviewPublicProviderMedia(user.id, fileId, FileReviewStatus.REJECTED, body.reason);
  }

  @Post(['providers/:id/reject', 'partners/:id/reject'])
  rejectProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.REJECTED, body.reason);
  }
}
