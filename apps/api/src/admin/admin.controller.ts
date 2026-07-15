import { Body, Controller, Delete, Get, Header, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FileReviewStatus, Role, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminReasonDto,
  AssignCompanyBankTransactionImportBatchDto,
  AssignCompanyBankTransactionReviewDto,
  AllocatePartnerBankDepositCashDebtDto,
  AdminCalendarActorDto,
  AdminOperatorActivityDto,
  AdminPushCampaignDto,
  ActivatePaymentFeePolicyVersionDto,
  BookingCloseoutDto,
  BookingOpsNoteDto,
  BookingOpsReasonDto,
  BookingOpsTaskDto,
  BookingPostMatchCancellationDecisionDto,
  BulkUpsertServicePayoutRulesDto,
  CreateAdminOperatorDto,
  CreateAdminCalendarEventDto,
  CreateAdminServiceDto,
  CreateBankReconciliationMatchDto,
  CreateCompanyBankAccountDto,
  CreateCompanyBankTransactionDto,
  CreateCouponDto,
  CreateManualWalletAdjustmentDto,
  CreateManualWalletAdjustmentRequestDto,
  CreatePartnerBankDepositRequestDto,
  CreatePartnerReportDto,
  CreatePartnerSanctionDto,
  CreatePaymentFeePolicyVersionDto,
  ClosePaymentFeePolicyApprovalDto,
  CreatePayoutBatchDto,
  CreateServiceDurationSetDto,
  CustomerOpsNoteDto,
  DeleteAdminOperatorAccessDto,
  IgnoreCompanyBankTransactionDto,
  ImportCompanyBankTransactionBatchDto,
  MarkEarningPaidDto,
  ModerateReviewDto,
  OperationsHandoffNoteDto,
  PartnerOpsNoteDto,
  PreviewManualWalletAdjustmentDto,
  PreviewCompanyBankTransactionBatchDto,
  ReferralRewardCashoutPaidDto,
  ReferralRewardDecisionDto,
  RecordPartnerBankDepositDto,
  RejectManualWalletAdjustmentRequestDto,
  RejectPartnerBankDepositRequestDto,
  RepairBookingSettlementGapDto,
  RequestPaymentFeePolicyApprovalDto,
  ReverseBankReconciliationMatchDto,
  UpdateAdminServiceDto,
  UpdateAdminCalendarEventDto,
  UpdateAdminOperatorAccessDto,
  UpdateCompanyBankAccountDto,
  UpdateCouponDto,
  UpdateFinanceApproverRoleDto,
  UpdateMonthlyTaxClosingStatusDto,
  UpdateNotificationTemplateDto,
  UpdateOperationalPolicyDto,
  UpdatePaymentFeePolicyVersionDto,
  UpdateProviderWalletWithdrawalRequestDto,
  UpdateReferralPolicyDto,
  UpdatePartnerReportDto,
  UpdatePayoutBatchDto,
  UpdateServicePayoutRuleDto,
  UpsertMarketingSpendDailyDto,
  UpsertPaymentFeeRuleDto,
  UpsertServicePayoutRuleDto,
  VerifyAdminOperatorLoginDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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

  @Get('customers')
  customers(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
    @Query('joinedFrom') joinedFrom?: string,
    @Query('joinedTo') joinedTo?: string,
    @Query('lastBookingFrom') lastBookingFrom?: string,
    @Query('lastBookingTo') lastBookingTo?: string,
    @Query('lastLoginFrom') lastLoginFrom?: string,
    @Query('lastLoginTo') lastLoginTo?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listCustomers({
      country,
      gender,
      joinedFrom,
      joinedTo,
      lastBookingFrom,
      lastBookingTo,
      lastLoginFrom,
      lastLoginTo,
      q,
      skip,
      sort,
      take,
    });
  }

  @Get('customers/summary')
  customerSummary(
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
    @Query('joinedFrom') joinedFrom?: string,
    @Query('joinedTo') joinedTo?: string,
    @Query('lastBookingFrom') lastBookingFrom?: string,
    @Query('lastBookingTo') lastBookingTo?: string,
    @Query('lastLoginFrom') lastLoginFrom?: string,
    @Query('lastLoginTo') lastLoginTo?: string,
  ) {
    return this.admin.customerSummary({
      country,
      gender,
      joinedFrom,
      joinedTo,
      lastBookingFrom,
      lastBookingTo,
      lastLoginFrom,
      lastLoginTo,
      q,
    });
  }

  @Get('customers/:id')
  customerDetail(
    @Param('id') customerProfileId: string,
    @Query('includeDiagnostics') includeDiagnostics?: string,
  ) {
    return this.admin.getCustomerDetail(customerProfileId, {
      includeDiagnostics: includeDiagnostics !== 'false',
    });
  }

  @Post('customers/:id/ops-note')
  addCustomerOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') customerProfileId: string,
    @Body() body: CustomerOpsNoteDto,
  ) {
    return this.admin.addCustomerOpsNote(user.id, customerProfileId, body);
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
  usageOverview(@Query('range') range?: string) {
    return this.admin.getUsageOverview(range);
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
  ) {
    return this.admin.getPartnerOverview({
      city,
      onlineStatus,
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
  ) {
    return this.admin.listCustomerReferralParents({ take, skip, q, status, reward });
  }

  @Get('referrals/customers/summary')
  customerReferralParentSummary(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
  ) {
    return this.admin.customerReferralParentSummary({ q, status, reward });
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
  ) {
    return this.admin.listPartnerReferralParents({ take, skip, q, status, reward });
  }

  @Get('referrals/partners/summary')
  partnerReferralParentSummary(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('reward') reward?: string,
  ) {
    return this.admin.partnerReferralParentSummary({ q, status, reward });
  }

  @Get('referrals/partners/:id')
  partnerReferralParent(@Param('id') providerProfileId: string) {
    return this.admin.getPartnerReferralParent(providerProfileId);
  }

  @Get(['providers', 'partners'])
  providers() {
    return this.admin.listProviders();
  }

  @Get('operations-policy/providers')
  operationsPolicyProviders(@Query('take') take?: string) {
    return this.admin.listOperationsPolicyProviders({ take });
  }

  @Get('operations-handoff/providers')
  operationsHandoffProviders(@Query('take') take?: string) {
    return this.admin.listOperationsHandoffProviders({ take });
  }

  @Get('partner-controls/providers')
  partnerControlProviders(@Query('take') take?: string) {
    return this.admin.listPartnerControlProviders({ take });
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
  ) {
    return this.admin.listPartnerDirectoryProviders({
      bookingFlow,
      kyc,
      providerStatus,
      q,
      review,
      skip,
      sort,
      take,
      verification,
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
  ) {
    return this.admin.partnerDirectorySummary({ bookingFlow, kyc, providerStatus, q, review, verification });
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
  enablePushDevice(@CurrentUser() user: AuthenticatedUser, @Param('id') pushDeviceId: string) {
    return this.admin.enablePushDevice(user.id, pushDeviceId);
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
  unblockProviderAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.unblockProviderAccount(user.id, providerProfileId);
  }

  @Get(['provider-reports', 'partner-reports'])
  providerReports(@Query('take') take?: string) {
    return this.admin.listProviderReports({ take });
  }

  @Post(['provider-reports', 'partner-reports'])
  createProviderReport(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePartnerReportDto) {
    return this.admin.createProviderReport(user.id, body);
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
  providerSanctions(@Query('take') take?: string) {
    return this.admin.listProviderSanctions({ take });
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
  liftProviderSanction(@CurrentUser() user: AuthenticatedUser, @Param('id') sanctionId: string) {
    return this.admin.liftProviderSanction(user.id, sanctionId);
  }

  @Post(['providers/:id/sync-supabase-role', 'partners/:id/sync-supabase-role'])
  syncProviderSupabaseRole(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.syncProviderSupabaseRole(user.id, providerProfileId);
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

  @Get('bookings')
  bookings(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('statusGroup') statusGroup?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listBookings({ dateFrom, dateRange, dateTo, statusGroup, take });
  }

  @Get('chat-archive')
  chatArchive(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('sender') sender?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listChatArchive({ dateFrom, dateRange, dateTo, q, sender, skip, status, take });
  }

  @Get('chat-archive/summary')
  chatArchiveSummary(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('sender') sender?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.chatArchiveSummary({ dateFrom, dateRange, dateTo, q, sender, status });
  }

  @Get('bookings/:id/notifications')
  bookingNotifications(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.listBookingNotifications(id, { take });
  }

  @Get('bookings/:id/chat-messages')
  bookingChatMessages(@Param('id') id: string) {
    return this.admin.listBookingChatMessages(id);
  }

  @Get('bookings/:id/marketplace-providers')
  bookingMarketplaceProviders(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.listBookingMarketplaceProviders(id, { take });
  }

  @Get('bookings/:id')
  bookingDetail(@Param('id') id: string, @Query('includeDiagnostics') includeDiagnostics?: string) {
    return this.admin.getBookingDetail(id, {
      includeDiagnostics: includeDiagnostics !== 'false',
    });
  }

  @Post('bookings/:id/ops-note')
  addBookingOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsNoteDto,
  ) {
    return this.admin.addBookingOpsNote(user.id, id, body);
  }

  @Post('bookings/:id/repair-chat-room')
  repairBookingChatRoom(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.repairBookingChatRoom(user.id, id);
  }

  @Post('bookings/:id/no-show')
  markBookingNoShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsReasonDto,
  ) {
    return this.admin.markBookingNoShow(user.id, id, body);
  }

  @Post('bookings/:id/expire')
  expireBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsReasonDto,
  ) {
    return this.admin.expireBooking(user.id, id, body);
  }

  @Post('bookings/:id/closeout')
  closeoutCompletedBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingCloseoutDto,
  ) {
    return this.admin.closeoutCompletedBooking(user.id, id, body);
  }

  @Post('bookings/:id/post-match-cancellation/approve')
  approvePostMatchCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingPostMatchCancellationDecisionDto,
  ) {
    return this.admin.approvePostMatchCancellation(user.id, id, body);
  }

  @Post('bookings/:id/post-match-cancellation/hold')
  holdPostMatchCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingPostMatchCancellationDecisionDto,
  ) {
    return this.admin.holdPostMatchCancellation(user.id, id, body);
  }

  @Post('bookings/:id/ops-task')
  updateBookingOpsTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsTaskDto,
  ) {
    return this.admin.updateBookingOpsTask(user.id, id, body);
  }

  @Get('payments')
  payments(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPayments({ range, review, skip, take });
  }

  @Get('payments/summary')
  paymentSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.paymentSummary({ range, review });
  }

  @Get('payments/:id')
  paymentDetail(@Param('id') paymentId: string) {
    return this.admin.getPaymentDetail(paymentId);
  }

  @Get('payment-callback-attempts')
  paymentCallbackAttempts(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listPaymentCallbackAttempts({ range, review, take });
  }

  @Get('refunds')
  refunds(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listRefunds({ range, review, skip, take });
  }

  @Get('refunds/summary')
  refundSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.refundSummary({ range, review });
  }

  @Get('finance-overview')
  financeOverviewSummary(@Query('range') range?: string, @Query('period') period?: string) {
    return this.admin.financeOverviewSummary({ period, range });
  }

  @Get('earnings')
  earnings(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listEarnings({ range, review, skip, take });
  }

  @Get('cash-settlement-earnings')
  cashSettlementEarnings(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('queue') queue?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listCashSettlementEarnings({ q, queue, range, skip, take });
  }

  @Get('cash-settlement-summary')
  cashSettlementSummary(
    @Query('range') range?: string,
    @Query('queue') queue?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.cashSettlementSummary({ q, queue, range });
  }

  @Get('earnings/summary')
  earningsSummary(@Query('range') range?: string) {
    return this.admin.earningsSummary({ range });
  }

  @Get('booking-settlement-gaps')
  bookingSettlementGaps(
    @Query('age') age?: string,
    @Query('track') track?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listBookingSettlementGaps({ age, paymentMethod, period, q, skip, take, track });
  }

  @Get('booking-settlement-gaps/summary')
  bookingSettlementGapSummary() {
    return this.admin.bookingSettlementGapSummary();
  }

  @Get('booking-settlement-gaps/dry-run')
  bookingSettlementGapDryRun(
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.bookingSettlementGapDryRun({ paymentMethod, period, take });
  }

  @Get('booking-settlement-gaps/:id/preview')
  previewBookingSettlementGapRepair(@Param('id') id: string) {
    return this.admin.previewBookingSettlementGapRepair(id);
  }

  @Get('booking-settlement-gaps/:id/checkpoint')
  verifyBookingSettlementRepair(@Param('id') id: string) {
    return this.admin.verifyBookingSettlementRepair(id);
  }

  @Post('booking-settlement-gaps/:id/repair')
  repairBookingSettlementGap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RepairBookingSettlementGapDto,
  ) {
    return this.admin.repairBookingSettlementGap(user.id, id, body);
  }

  @Get('booking-settlement-snapshots')
  bookingSettlementSnapshots(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listBookingSettlementSnapshots({ paymentMethod, period, range, review, skip, take });
  }

  @Get('booking-settlement-snapshots/summary')
  bookingSettlementSnapshotSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.admin.bookingSettlementSnapshotSummary({ paymentMethod, period, range, review });
  }

  @Get('booking-settlement-reversals')
  bookingSettlementReversals(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listBookingSettlementReversals({ range, review, skip, take });
  }

  @Get('booking-settlement-reversals/summary')
  bookingSettlementReversalSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.bookingSettlementReversalSummary({ range, review });
  }

  @Get('booking-settlement-reversals/:id')
  bookingSettlementReversal(@Param('id') id: string) {
    return this.admin.getBookingSettlementReversal(id);
  }

  @Get('booking-settlement-snapshots/coupon-finance')
  couponFinanceSnapshots(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listCouponFinanceSnapshots({ range, review, skip, take });
  }

  @Get('booking-settlement-snapshots/coupon-finance-summary')
  couponFinanceSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.couponFinanceSummary({ range, review });
  }

  @Get('booking-settlement-snapshots/:id')
  bookingSettlementSnapshot(@Param('id') id: string) {
    return this.admin.getBookingSettlementSnapshot(id);
  }

  @Get('partner-withholding-tax')
  partnerWithholdingTax(
    @Query('period') period?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerWithholdingTax({ period, skip, take });
  }

  @Get('partner-withholding-tax/summary')
  partnerWithholdingTaxSummary(@Query('period') period?: string) {
    return this.admin.partnerWithholdingTaxSummary({ period });
  }

  @Get('monthly-tax-closings')
  monthlyTaxClosings(
    @Query('period') period?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listMonthlyTaxClosings({ period, skip, take });
  }

  @Get('monthly-tax-closings/summary')
  monthlyTaxClosingSummary(@Query('period') period?: string) {
    return this.admin.monthlyTaxClosingSummary({ period });
  }

  @Patch('monthly-tax-closings/:period/status')
  updateMonthlyTaxClosingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('period') period: string,
    @Body() body: UpdateMonthlyTaxClosingStatusDto,
  ) {
    return this.admin.updateMonthlyTaxClosingStatus(user.id, period, body);
  }

  @Get('platform-vat/summary')
  platformVatSummary(@Query('period') period?: string) {
    return this.admin.platformVatSummary({ period });
  }

  @Get('payment-fees/summary')
  paymentFeeSummary(@Query('period') period?: string) {
    return this.admin.paymentFeeSummary({ period });
  }

  @Get('payment-fee-policies')
  paymentFeePolicies(@Query('take') take?: string) {
    return this.admin.listPaymentFeePolicies({ take });
  }

  @Get('payment-fee-policies/:id/preflight')
  paymentFeePolicyPreflight(@Param('id') id: string, @Query('sampleAmount') sampleAmount?: string) {
    return this.admin.paymentFeePolicyPreflight(id, { sampleAmount });
  }

  @Get('payment-fee-policies/:id/approval')
  paymentFeePolicyApproval(@Param('id') id: string) {
    return this.admin.paymentFeePolicyApproval(id);
  }

  @Post('payment-fee-policies')
  createPaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentFeePolicyVersionDto,
  ) {
    return this.admin.createPaymentFeePolicy(user.id, body);
  }

  @Patch('payment-fee-policies/:id')
  updatePaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdatePaymentFeePolicyVersionDto,
  ) {
    return this.admin.updatePaymentFeePolicy(user.id, id, body);
  }

  @Post('payment-fee-policies/:id/rules')
  upsertPaymentFeeRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpsertPaymentFeeRuleDto,
  ) {
    return this.admin.upsertPaymentFeeRule(user.id, id, body);
  }

  @Post('payment-fee-policies/:id/approval-request')
  requestPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RequestPaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.requestPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/approval-reject')
  rejectPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ClosePaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.rejectPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/approval-cancel')
  cancelPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ClosePaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.cancelPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/activate')
  activatePaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ActivatePaymentFeePolicyVersionDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.activatePaymentFeePolicy(user.id, id, body, operatorIdentity);
  }

  @Get('accounting-journal-batches')
  accountingJournalBatches(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listAccountingJournalBatches({ range, review, skip, take });
  }

  @Get('accounting-journal-batches/summary')
  accountingJournalBatchSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.accountingJournalBatchSummary({ range, review });
  }

  @Get('accounting-journal-batches/:id')
  accountingJournalBatchDetail(@Param('id') id: string) {
    return this.admin.accountingJournalBatchDetail(id);
  }

  @Get('booking-payment-clearing')
  bookingPaymentClearingEntries(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listBookingPaymentClearingEntries({ range, review, skip, take });
  }

  @Get('booking-payment-clearing/summary')
  bookingPaymentClearingSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.bookingPaymentClearingSummary({ range, review });
  }

  @Get('booking-payment-clearing/:id')
  bookingPaymentClearingEntryDetail(@Param('id') id: string) {
    return this.admin.bookingPaymentClearingEntryDetail(id);
  }

  @Get('company-bank-accounts')
  companyBankAccounts(@Query('status') status?: string) {
    return this.admin.listCompanyBankAccounts({ status });
  }

  @Post('company-bank-accounts')
  createCompanyBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCompanyBankAccountDto,
  ) {
    return this.admin.createCompanyBankAccount(user.id, input);
  }

  @Patch('company-bank-accounts/:id')
  updateCompanyBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateCompanyBankAccountDto,
  ) {
    return this.admin.updateCompanyBankAccount(user.id, id, input);
  }

  @Get('bank-reconciliation')
  bankReconciliationTransactions(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
  ) {
    return this.admin.listBankReconciliationTransactions({
      assigneeAdminId,
      assignment,
      candidate,
      q,
      range,
      review,
      skip,
      take,
    });
  }

  @Get('bank-reconciliation/summary')
  bankReconciliationSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
  ) {
    return this.admin.bankReconciliationSummary({
      assigneeAdminId,
      assignment,
      candidate,
      q,
      range,
      review,
    });
  }

  @Get('bank-reconciliation/withdrawal-candidate-summary')
  bankReconciliationWithdrawalCandidateSummary(
    @Query('range') range?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.bankReconciliationWithdrawalCandidateSummary({ q, range });
  }

  @Get('bank-reconciliation/import-batches')
  bankReconciliationImportBatches(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('range') range?: string,
    @Query('q') q?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listCompanyBankTransactionImportBatches({ q, range, review, skip, take });
  }

  @Get('bank-reconciliation/import-batches/summary')
  bankReconciliationImportBatchSummary() {
    return this.admin.companyBankTransactionImportBatchSummary();
  }

  @Get('bank-reconciliation/import-batches/:batchImportId')
  bankReconciliationImportBatchDetail(@Param('batchImportId') batchImportId: string) {
    return this.admin.companyBankTransactionImportBatchDetail(batchImportId);
  }

  @Post('bank-reconciliation/import-batches/:batchImportId/assignment')
  assignBankReconciliationImportBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchImportId') batchImportId: string,
    @Body() body: AssignCompanyBankTransactionImportBatchDto,
  ) {
    return this.admin.assignCompanyBankTransactionImportBatch(user.id, batchImportId, body);
  }

  @Get('bank-reconciliation/:id')
  bankReconciliationTransactionDetail(@Param('id') id: string) {
    return this.admin.bankReconciliationTransactionDetail(id);
  }

  @Post('bank-reconciliation/:id/review-assignment')
  assignBankReconciliationTransactionReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignCompanyBankTransactionReviewDto,
  ) {
    return this.admin.assignCompanyBankTransactionReview(user.id, id, body);
  }

  @Post('bank-reconciliation/transactions')
  createCompanyBankTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompanyBankTransactionDto,
  ) {
    return this.admin.createCompanyBankTransaction(user.id, body);
  }

  @Post('bank-reconciliation/transactions/batch-preview')
  previewCompanyBankTransactionBatch(@Body() body: PreviewCompanyBankTransactionBatchDto) {
    return this.admin.previewCompanyBankTransactionBatch(body);
  }

  @Post('bank-reconciliation/transactions/batch-import')
  importCompanyBankTransactionBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportCompanyBankTransactionBatchDto,
  ) {
    return this.admin.importCompanyBankTransactionBatch(user.id, body);
  }

  @Post('bank-reconciliation/:id/matches')
  createBankReconciliationMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateBankReconciliationMatchDto,
  ) {
    return this.admin.createBankReconciliationMatch(user.id, id, body);
  }

  @Post('bank-reconciliation/:id/matches/:matchId/reverse')
  reverseBankReconciliationMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() body: ReverseBankReconciliationMatchDto,
  ) {
    return this.admin.reverseBankReconciliationMatch(user.id, id, matchId, body);
  }

  @Post('bank-reconciliation/:id/ignore')
  ignoreCompanyBankTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: IgnoreCompanyBankTransactionDto,
  ) {
    return this.admin.ignoreCompanyBankTransaction(user.id, id, body);
  }

  @Get('services')
  services() {
    return this.admin.listServices();
  }

  @Get('services/groups')
  serviceGroups() {
    return this.admin.listServiceGroups();
  }

  @Post('services/duration-sets')
  createServiceDurationSet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateServiceDurationSetDto,
  ) {
    return this.admin.createServiceDurationSet(user.id, body);
  }

  @Post('services')
  createService(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAdminServiceDto) {
    return this.admin.createService(user.id, body);
  }

  @Patch('services/:id')
  updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAdminServiceDto,
  ) {
    return this.admin.updateService(user.id, id, body);
  }

  @Post('services/:id/payout-rules')
  upsertServicePayoutRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Body() body: UpsertServicePayoutRuleDto,
  ) {
    return this.admin.upsertServicePayoutRule(user.id, serviceId, body);
  }

  @Post('services/:id/payout-rules/bulk')
  bulkUpsertServicePayoutRules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Body() body: BulkUpsertServicePayoutRulesDto,
  ) {
    return this.admin.bulkUpsertServicePayoutRules(user.id, serviceId, body);
  }

  @Patch('service-payout-rules/:id')
  updateServicePayoutRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateServicePayoutRuleDto,
  ) {
    return this.admin.updateServicePayoutRule(user.id, id, body);
  }

  @Post('earnings/:id/mark-paid')
  markEarningPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MarkEarningPaidDto,
  ) {
    return this.admin.markEarningPaid(user.id, id, body);
  }

  @Post('provider-wallet/deposits')
  @Header('X-HANDS-Deprecated', 'true')
  @Header('X-HANDS-Successor-Path', '/api/admin/provider-wallet/deposit-requests')
  /** @deprecated Use the persistent deposit request route followed by a separate approver decision. */
  recordPartnerBankDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPartnerBankDepositDto,
  ) {
    return this.admin.approvePartnerBankDepositFromLegacyRoute(user.id, body);
  }

  @Get('provider-wallet/deposit-requests')
  partnerBankDepositRequests(
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerBankDepositRequests({ skip, status, take });
  }

  @Get('provider-wallet/deposit-requests/history')
  partnerBankDepositRequestHistory(
    @Query('status') status?: string,
    @Query('review') review?: string,
    @Query('owner') owner?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('sla') sla?: string,
    @Query('period') period?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerBankDepositRequestHistory({
      assigneeAdminId,
      owner,
      period,
      q,
      review,
      skip,
      sla,
      status,
      take,
    });
  }

  @Get('provider-wallet/deposit-requests/:id')
  partnerBankDepositRequestDetail(@Param('id') id: string) {
    return this.admin.getPartnerBankDepositRequestDetail(id);
  }

  @Post('provider-wallet/deposit-requests')
  createPartnerBankDepositRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartnerBankDepositRequestDto,
  ) {
    return this.admin.createPartnerBankDepositRequest(user.id, body);
  }

  @Post('provider-wallet/deposit-requests/:id/approve')
  approvePartnerBankDepositRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.admin.approvePartnerBankDepositRequest(user.id, id);
  }

  @Post('provider-wallet/deposit-requests/:id/reject')
  rejectPartnerBankDepositRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectPartnerBankDepositRequestDto,
  ) {
    return this.admin.rejectPartnerBankDepositRequest(user.id, id, body.reason);
  }

  @Post('provider-wallet/deposit-requests/:id/reconciliation-assignment')
  assignPartnerBankDepositReconciliationReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignCompanyBankTransactionReviewDto,
  ) {
    return this.admin.assignPartnerBankDepositReconciliationReview(user.id, id, body);
  }

  @Post('provider-wallet/deposit-requests/:id/cash-debt-allocations')
  allocatePartnerBankDepositCashDebt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AllocatePartnerBankDepositCashDebtDto,
  ) {
    return this.admin.allocatePartnerBankDepositCashDebt(user.id, id, body);
  }

  @Get('finance-approval-queue')
  financeApprovalQueue(@Query('take') take?: string) {
    return this.admin.financeApprovalQueue({ take });
  }

  @Get('wallet-adjustments')
  manualWalletAdjustments(
    @Query('take') take?: string,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listManualWalletAdjustments({ ownerId, ownerType, skip, take });
  }

  @Get('wallet-adjustments/summary')
  manualWalletAdjustmentSummary(@Query('ownerType') ownerType?: string, @Query('ownerId') ownerId?: string) {
    return this.admin.manualWalletAdjustmentSummary({ ownerId, ownerType });
  }

  @Post('wallet-adjustments/preview')
  previewManualWalletAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PreviewManualWalletAdjustmentDto,
  ) {
    return this.admin.previewManualWalletAdjustment(user.id, body);
  }

  @Post('wallet-adjustments')
  @Header('X-HANDS-Deprecated', 'true')
  @Header('X-HANDS-Successor-Path', '/api/admin/wallet-adjustment-requests')
  /** @deprecated Use POST /api/admin/wallet-adjustment-requests followed by a separate approver decision. */
  createManualWalletAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateManualWalletAdjustmentDto,
  ) {
    return this.admin.approveManualWalletAdjustmentFromLegacyRoute(user.id, body);
  }

  @Get('wallet-adjustment-requests')
  manualWalletAdjustmentRequests(
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listManualWalletAdjustmentRequests({ skip, status, take });
  }

  @Post('wallet-adjustment-requests')
  createManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateManualWalletAdjustmentRequestDto,
  ) {
    return this.admin.createManualWalletAdjustmentRequest(user.id, body);
  }

  @Post('wallet-adjustment-requests/:id/approve')
  approveManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.admin.approveManualWalletAdjustmentRequest(user.id, id);
  }

  @Post('wallet-adjustment-requests/:id/reject')
  rejectManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectManualWalletAdjustmentRequestDto,
  ) {
    return this.admin.rejectManualWalletAdjustmentRequest(user.id, id, body.reason);
  }

  @Get('provider-wallet/withdrawal-requests')
  providerWalletWithdrawalRequests(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('status') status?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('reconciliation') reconciliation?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listProviderWalletWithdrawalRequests({
      providerProfileId,
      range,
      reconciliation,
      skip,
      status,
      take,
    });
  }

  @Get('provider-wallet/withdrawal-requests/summary')
  providerWalletWithdrawalRequestSummary(
    @Query('range') range?: string,
    @Query('providerProfileId') providerProfileId?: string,
  ) {
    return this.admin.providerWalletWithdrawalRequestSummary({ providerProfileId, range });
  }

  @Patch('provider-wallet/withdrawal-requests/:id')
  updateProviderWalletWithdrawalRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateProviderWalletWithdrawalRequestDto,
  ) {
    return this.admin.updateProviderWalletWithdrawalRequest(user.id, id, body);
  }

  @Get('payout-batches/summary')
  payoutBatchSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.payoutBatchSummary({ range, review });
  }

  @Get('payout-batches')
  payoutBatches(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPayoutBatches({ range, review, skip, take });
  }

  @Post('payout-batches')
  createPayoutBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePayoutBatchDto) {
    return this.admin.createPayoutBatch(user.id, body);
  }

  @Patch('payout-batches/:id')
  updatePayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdatePayoutBatchDto,
  ) {
    return this.admin.updatePayoutBatch(user.id, id, body);
  }

  @Get('reviews')
  reviews(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('review') review?: string,
    @Query('sort') sort?: string,
    @Query('q') q?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.admin.listReviews({
      bookingId,
      customerProfileId,
      from,
      providerProfileId,
      q,
      review,
      skip,
      sort,
      take,
      to,
    });
  }

  @Get('reviews/summary')
  reviewSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.admin.reviewSummary({ bookingId, customerProfileId, from, providerProfileId, q, review, to });
  }

  @Get('partner-customer-reviews')
  partnerCustomerReviews(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('q') q?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.admin.listPartnerCustomerReviews({
      bookingId,
      customerProfileId,
      from,
      providerProfileId,
      q,
      skip,
      sort,
      take,
      to,
    });
  }

  @Get('partner-customer-reviews/summary')
  partnerCustomerReviewSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.admin.partnerCustomerReviewSummary({
      bookingId,
      customerProfileId,
      from,
      providerProfileId,
      q,
      to,
    });
  }

  @Patch('reviews/:id/moderate')
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ModerateReviewDto,
  ) {
    return this.admin.moderateReview(user.id, id, body);
  }

  @Get('coupons')
  coupons(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listCoupons({ skip, take });
  }

  @Get('coupons/summary')
  couponSummary() {
    return this.admin.couponSummary();
  }

  @Get('coupons/:id/usage')
  couponUsage(@Param('id') id: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listCouponUsageBookings(id, { skip, take });
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCouponDto) {
    return this.admin.createCoupon(user.id, body);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCouponDto,
  ) {
    return this.admin.updateCoupon(user.id, id, body);
  }

  @Delete('coupons/:id')
  deleteCoupon(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.deleteCoupon(user.id, id);
  }

  @Get('audit-logs')
  auditLogs(
    @Query('action') action?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('bucket') bucket?: string,
    @Query('priority') priority?: string,
  ) {
    return this.admin.listAuditLogs({ action, bucket, from, priority, q, skip, take, to });
  }

  @Get('audit-logs/summary')
  auditLogSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('bucket') bucket?: string,
    @Query('priority') priority?: string,
  ) {
    return this.admin.auditLogSummary({ bucket, from, priority, q, to });
  }

  @Post('operations-handoff/note')
  addOperationsHandoffNote(@CurrentUser() user: AuthenticatedUser, @Body() body: OperationsHandoffNoteDto) {
    return this.admin.addOperationsHandoffNote(user.id, body);
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
  ) {
    return this.admin.listNotifications({
      booking,
      financeAge,
      financeOwner,
      from,
      incidentState,
      review,
      skip,
      take,
      to,
      user,
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
  ) {
    return this.admin.notificationSummary({
      booking,
      financeAge,
      financeOwner,
      from,
      incidentState,
      review,
      to,
      user,
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
  retryNotification(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.retryNotification(user.id, id);
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
