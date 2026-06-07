import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  FileReviewStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminReasonDto,
  BookingCloseoutDto,
  BookingOpsNoteDto,
  BookingOpsReasonDto,
  BookingOpsTaskDto,
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
  UpdateAdminServiceDto,
  UpdateCouponDto,
  UpdateOperationalPolicyDto,
  UpdatePartnerReportDto,
  UpdatePayoutBatchDto,
  UpdateServicePayoutRuleDto,
  UpsertServicePayoutRuleDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Get('customers')
  customers() {
    return this.admin.listCustomers();
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
  appSessions() {
    return this.admin.listAppSessions();
  }

  @Get('providers')
  providers() {
    return this.admin.listProviders();
  }

  @Get('partners')
  partners() {
    return this.admin.listProviders();
  }

  @Get('providers/:id/overview')
  providerOverview(@Param('id') providerProfileId: string) {
    return this.admin.getProviderOverview(providerProfileId);
  }

  @Get('partners/:id/overview')
  partnerOverview(@Param('id') providerProfileId: string) {
    return this.admin.getProviderOverview(providerProfileId);
  }

  @Get('providers/:id')
  providerDetail(@Param('id') providerProfileId: string) {
    return this.admin.getProviderDetail(providerProfileId);
  }

  @Get('partners/:id')
  partnerDetail(@Param('id') providerProfileId: string) {
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

  @Post('providers/:id/approve')
  approveProvider(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.APPROVED);
  }

  @Post('partners/:id/approve')
  approvePartner(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.APPROVED);
  }

  @Post('providers/:id/block')
  blockProviderAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.blockProviderAccount(user.id, providerProfileId, body.reason);
  }

  @Post('partners/:id/block')
  blockPartnerAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.blockProviderAccount(user.id, providerProfileId, body.reason);
  }

  @Post('providers/:id/unblock')
  unblockProviderAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.unblockProviderAccount(user.id, providerProfileId);
  }

  @Post('partners/:id/unblock')
  unblockPartnerAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.unblockProviderAccount(user.id, providerProfileId);
  }

  @Get('provider-reports')
  providerReports() {
    return this.admin.listProviderReports();
  }

  @Get('partner-reports')
  partnerReports() {
    return this.admin.listProviderReports();
  }

  @Post('provider-reports')
  createProviderReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartnerReportDto,
  ) {
    return this.admin.createProviderReport(user.id, body);
  }

  @Post('partner-reports')
  createPartnerReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartnerReportDto,
  ) {
    return this.admin.createProviderReport(user.id, body);
  }

  @Patch('provider-reports/:id')
  updateProviderReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
    @Body() body: UpdatePartnerReportDto,
  ) {
    return this.admin.updateProviderReport(user.id, reportId, body);
  }

  @Patch('partner-reports/:id')
  updatePartnerReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
    @Body() body: UpdatePartnerReportDto,
  ) {
    return this.admin.updateProviderReport(user.id, reportId, body);
  }

  @Get('provider-sanctions')
  providerSanctions() {
    return this.admin.listProviderSanctions();
  }

  @Get('partner-sanctions')
  partnerSanctions() {
    return this.admin.listProviderSanctions();
  }

  @Post('providers/:id/sanctions')
  createProviderSanction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: CreatePartnerSanctionDto,
  ) {
    return this.admin.createProviderSanction(user.id, providerProfileId, body);
  }

  @Post('partners/:id/sanctions')
  createPartnerSanction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: CreatePartnerSanctionDto,
  ) {
    return this.admin.createProviderSanction(user.id, providerProfileId, body);
  }

  @Post('provider-sanctions/:id/lift')
  liftProviderSanction(@CurrentUser() user: AuthenticatedUser, @Param('id') sanctionId: string) {
    return this.admin.liftProviderSanction(user.id, sanctionId);
  }

  @Post('partner-sanctions/:id/lift')
  liftPartnerSanction(@CurrentUser() user: AuthenticatedUser, @Param('id') sanctionId: string) {
    return this.admin.liftProviderSanction(user.id, sanctionId);
  }

  @Post('providers/:id/sync-supabase-role')
  syncProviderSupabaseRole(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.syncProviderSupabaseRole(user.id, providerProfileId);
  }

  @Post('partners/:id/sync-supabase-role')
  syncPartnerSupabaseRole(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.syncProviderSupabaseRole(user.id, providerProfileId);
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

  @Post('providers/:id/reject')
  rejectProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.REJECTED, body.reason);
  }

  @Post('partners/:id/reject')
  rejectPartner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: AdminReasonDto,
  ) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.REJECTED, body.reason);
  }

  @Get('bookings')
  bookings() {
    return this.admin.listBookings();
  }

  @Get('chat-archive')
  chatArchive() {
    return this.admin.listChatArchive();
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

  @Post('bookings/:id/ops-task')
  updateBookingOpsTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsTaskDto,
  ) {
    return this.admin.updateBookingOpsTask(user.id, id, body);
  }

  @Get('payments')
  payments() {
    return this.admin.listPayments();
  }

  @Get('payments/:id')
  paymentDetail(@Param('id') paymentId: string) {
    return this.admin.getPaymentDetail(paymentId);
  }

  @Get('payment-callback-attempts')
  paymentCallbackAttempts() {
    return this.admin.listPaymentCallbackAttempts();
  }

  @Get('refunds')
  refunds() {
    return this.admin.listRefunds();
  }

  @Get('earnings')
  earnings() {
    return this.admin.listEarnings();
  }

  @Get('cash-settlement-earnings')
  cashSettlementEarnings() {
    return this.admin.listCashSettlementEarnings();
  }

  @Get('cash-settlement-summary')
  cashSettlementSummary() {
    return this.admin.cashSettlementSummary();
  }

  @Get('earnings/summary')
  earningsSummary() {
    return this.admin.earningsSummary();
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
  createService(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAdminServiceDto,
  ) {
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

  @Get('payout-batches')
  payoutBatches() {
    return this.admin.listPayoutBatches();
  }

  @Post('payout-batches')
  createPayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePayoutBatchDto,
  ) {
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
  reviews() {
    return this.admin.listReviews();
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
  coupons() {
    return this.admin.listCoupons();
  }

  @Post('coupons')
  createCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCouponDto,
  ) {
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

  @Get('audit-logs')
  auditLogs() {
    return this.admin.listAuditLogs();
  }

  @Post('operations-handoff/note')
  addOperationsHandoffNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: OperationsHandoffNoteDto,
  ) {
    return this.admin.addOperationsHandoffNote(user.id, body);
  }

  @Get('operational-policy')
  operationalPolicy() {
    return this.admin.listOperationalPolicySettings();
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
  notifications() {
    return this.admin.listNotifications();
  }

  @Post('notifications/:id/retry')
  retryNotification(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.retryNotification(user.id, id);
  }
}
