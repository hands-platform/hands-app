import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  PayoutBatchStatus,
  ReviewStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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

  @Get('providers')
  providers() {
    return this.admin.listProviders();
  }

  @Get('providers/:id')
  providerDetail(@Param('id') providerProfileId: string) {
    return this.admin.getProviderDetail(providerProfileId);
  }

  @Post('push-devices/:id/enable')
  enablePushDevice(@CurrentUser() user: AuthenticatedUser, @Param('id') pushDeviceId: string) {
    return this.admin.enablePushDevice(user.id, pushDeviceId);
  }

  @Post('providers/:id/approve')
  approveProvider(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.APPROVED);
  }

  @Post('providers/:id/sync-supabase-role')
  syncProviderSupabaseRole(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.admin.syncProviderSupabaseRole(user.id, providerProfileId);
  }

  @Post('providers/:id/reject')
  rejectProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: { reason?: string },
  ) {
    return this.admin.reviewProvider(user.id, providerProfileId, VerificationStatus.REJECTED, body.reason);
  }

  @Get('bookings')
  bookings() {
    return this.admin.listBookings();
  }

  @Get('bookings/:id')
  bookingDetail(@Param('id') id: string) {
    return this.admin.getBookingDetail(id);
  }

  @Post('bookings/:id/ops-note')
  addBookingOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { note?: string; preset?: string },
  ) {
    return this.admin.addBookingOpsNote(user.id, id, body);
  }

  @Post('bookings/:id/ops-task')
  updateBookingOpsTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { type: BookingOpsTaskType; status: BookingOpsTaskStatus; note?: string },
  ) {
    return this.admin.updateBookingOpsTask(user.id, id, body);
  }

  @Get('payments')
  payments() {
    return this.admin.listPayments();
  }

  @Get('refunds')
  refunds() {
    return this.admin.listRefunds();
  }

  @Get('earnings')
  earnings() {
    return this.admin.listEarnings();
  }

  @Get('earnings/summary')
  earningsSummary() {
    return this.admin.earningsSummary();
  }

  @Post('earnings/:id/mark-paid')
  markEarningPaid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.markEarningPaid(user.id, id);
  }

  @Get('payout-batches')
  payoutBatches() {
    return this.admin.listPayoutBatches();
  }

  @Post('payout-batches')
  createPayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { providerProfileId: string; transferRef?: string; notes?: string },
  ) {
    return this.admin.createPayoutBatch(user.id, body);
  }

  @Patch('payout-batches/:id')
  updatePayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: PayoutBatchStatus;
      transferRef?: string | null;
      notes?: string | null;
    },
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
    @Body() body: { status: ReviewStatus; reportReason?: string },
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
    @Body()
    body: {
      code: string;
      description?: string;
      discount: unknown;
      active?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    return this.admin.createCoupon(user.id, body);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      description?: string;
      discount?: unknown;
      active?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    return this.admin.updateCoupon(user.id, id, body);
  }

  @Get('audit-logs')
  auditLogs() {
    return this.admin.listAuditLogs();
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
