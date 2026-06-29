import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FileReviewStatus, Role, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminReasonDto,
  AdminPushCampaignDto,
  BookingCloseoutDto,
  BookingOpsNoteDto,
  BookingOpsReasonDto,
  BookingOpsTaskDto,
  BookingPostMatchCancellationDecisionDto,
  BulkUpsertServicePayoutRulesDto,
  CreateAdminServiceDto,
  CreateCouponDto,
  CreatePartnerReportDto,
  CreatePartnerSanctionDto,
  CreatePayoutBatchDto,
  CreateServiceDurationSetDto,
  CustomerOpsNoteDto,
  MarkEarningPaidDto,
  ModerateReviewDto,
  OperationsHandoffNoteDto,
  PartnerOpsNoteDto,
  ReferralRewardDecisionDto,
  RecordPartnerBankDepositDto,
  UpdateAdminServiceDto,
  UpdateCouponDto,
  UpdateMonthlyTaxClosingStatusDto,
  UpdateNotificationTemplateDto,
  UpdateOperationalPolicyDto,
  UpdateProviderWalletWithdrawalRequestDto,
  UpdateReferralPolicyDto,
  UpdatePartnerReportDto,
  UpdatePayoutBatchDto,
  UpdateServicePayoutRuleDto,
  UpsertMarketingSpendDailyDto,
  UpsertServicePayoutRuleDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listUsers({ skip, take });
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
  customerDetail(@Param('id') customerProfileId: string) {
    return this.admin.getCustomerDetail(customerProfileId);
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
  dashboardSummary() {
    return this.admin.dashboardSummary();
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

  @Post('referrals/rewards/:id/reverse')
  reverseReferralReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') rewardId: string,
    @Body() body: ReferralRewardDecisionDto,
  ) {
    return this.admin.reverseReferralReward(user.id, rewardId, body);
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
  providerDetail(@Param('id') providerProfileId: string) {
    return this.admin.getProviderDetail(providerProfileId);
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
  bookingDetail(@Param('id') id: string) {
    return this.admin.getBookingDetail(id);
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
  ) {
    return this.admin.listPayments({ range, review, take });
  }

  @Get('payments/summary')
  paymentSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
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
  ) {
    return this.admin.listRefunds({ range, review, take });
  }

  @Get('refunds/summary')
  refundSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.refundSummary({ range, review });
  }

  @Get('earnings')
  earnings(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listEarnings({ range, review, take });
  }

  @Get('cash-settlement-earnings')
  cashSettlementEarnings(@Query('take') take?: string, @Query('range') range?: string) {
    return this.admin.listCashSettlementEarnings({ range, take });
  }

  @Get('cash-settlement-summary')
  cashSettlementSummary(@Query('range') range?: string) {
    return this.admin.cashSettlementSummary({ range });
  }

  @Get('earnings/summary')
  earningsSummary(@Query('range') range?: string) {
    return this.admin.earningsSummary({ range });
  }

  @Get('booking-settlement-snapshots')
  bookingSettlementSnapshots(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listBookingSettlementSnapshots({ range, review, take });
  }

  @Get('booking-settlement-snapshots/summary')
  bookingSettlementSnapshotSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.bookingSettlementSnapshotSummary({ range, review });
  }

  @Get('partner-withholding-tax')
  partnerWithholdingTax(@Query('period') period?: string, @Query('take') take?: string) {
    return this.admin.listPartnerWithholdingTax({ period, take });
  }

  @Get('partner-withholding-tax/summary')
  partnerWithholdingTaxSummary(@Query('period') period?: string) {
    return this.admin.partnerWithholdingTaxSummary({ period });
  }

  @Get('monthly-tax-closings')
  monthlyTaxClosings(@Query('period') period?: string, @Query('take') take?: string) {
    return this.admin.listMonthlyTaxClosings({ period, take });
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
  recordPartnerBankDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPartnerBankDepositDto,
  ) {
    return this.admin.recordPartnerBankDeposit(user.id, body);
  }

  @Get('provider-wallet/withdrawal-requests')
  providerWalletWithdrawalRequests(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listProviderWalletWithdrawalRequests({ range, status, take });
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
  ) {
    return this.admin.listPayoutBatches({ range, review, take });
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
    return this.admin.partnerCustomerReviewSummary({ bookingId, customerProfileId, from, providerProfileId, q, to });
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
  ) {
    return this.admin.listNotifications({ booking, from, review, skip, take, to });
  }

  @Get('notifications/summary')
  notificationSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('review') review?: string,
    @Query('booking') booking?: string,
  ) {
    return this.admin.notificationSummary({ booking, from, review, to });
  }

  @Get('notifications/templates')
  notificationTemplates() {
    return this.admin.listNotificationTemplates();
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
}
