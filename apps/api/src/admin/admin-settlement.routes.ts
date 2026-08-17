import { Body, Get, Param, PayloadTooLargeException, Post, Query, StreamableFile } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RepairBookingSettlementGapDto } from './admin.dto';
import { AdminPaymentRoutes } from './admin-payment.routes';

export class AdminSettlementRoutes extends AdminPaymentRoutes {
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
    return this.admin.listBookingSettlementGaps({
      age,
      paymentMethod,
      period,
      q,
      skip,
      take,
      track,
    });
  }

  @Get('booking-settlement-gaps/summary')
  bookingSettlementGapSummary(
    @Query('age') age?: string,
    @Query('track') track?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.bookingSettlementGapSummary({ age, paymentMethod, period, q, track });
  }

  @Get('booking-settlement-gaps/dry-run')
  bookingSettlementGapDryRun(
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.bookingSettlementGapDryRun({ paymentMethod, period, take });
  }

  @Get('booking-settlement-gaps/preview-batch')
  previewBookingSettlementGapRepairs(@Query('bookingIds') bookingIds?: string) {
    return this.admin.previewBookingSettlementGapRepairs(bookingIds);
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
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('owner') owner?: string,
    @Query('reason') reason?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.admin.listBookingSettlementSnapshots({
      ...(cursor ? { cursor } : {}),
      ...(owner ? { owner } : {}),
      paymentMethod,
      period,
      q,
      range,
      ...(reason ? { reason } : {}),
      review,
      skip,
      sort,
      ...(status ? { status } : {}),
      take,
    });
  }

  @Get('booking-settlement-snapshots/summary')
  bookingSettlementSnapshotSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('owner') owner?: string,
    @Query('reason') reason?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.bookingSettlementSnapshotSummary({
      ...(owner ? { owner } : {}),
      paymentMethod,
      period,
      q,
      range,
      ...(reason ? { reason } : {}),
      review,
      sort,
      ...(status ? { status } : {}),
    });
  }

  @Get('booking-settlement-snapshots/export')
  async exportBookingSettlementSnapshots(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('period') period?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('owner') owner?: string,
    @Query('reason') reason?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.admin.exportBookingSettlementSnapshots({
      ...(owner ? { owner } : {}),
      paymentMethod,
      period,
      q,
      range,
      ...(reason ? { reason } : {}),
      review,
      sort,
      ...(status ? { status } : {}),
    });
    if (result.truncated || !result.stream) {
      throw new PayloadTooLargeException({
        code: 'SETTLEMENT_AUDIT_EXPORT_TOO_LARGE',
        limit: 100_000,
        totalRows: result.totalRows,
      });
    }
    return new StreamableFile(result.stream, { type: 'application/x-ndjson; charset=utf-8' });
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
  bookingSettlementReversalSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
  ) {
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
    @Query('period') period?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listCouponFinanceSnapshots({ period, q, range, review, skip, sort, take });
  }

  @Get('booking-settlement-snapshots/coupon-finance-summary')
  couponFinanceSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('period') period?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.couponFinanceSummary({ period, q, range, review });
  }

  @Get('booking-settlement-snapshots/:id')
  bookingSettlementSnapshot(@Param('id') id: string) {
    return this.admin.getBookingSettlementSnapshot(id);
  }
}
