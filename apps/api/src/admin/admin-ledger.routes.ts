import { Body, Get, Param, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AssignBookingPaymentClearingReviewsDto,
  AssignCompanyBankTransactionReviewDto,
} from './admin.dto';
import { AdminSettlementRoutes } from './admin-settlement.routes';

export class AdminLedgerRoutes extends AdminSettlementRoutes {
  @Get('accounting-journal-batches')
  accountingJournalBatches(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('source') source?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listAccountingJournalBatches({ period, q, range, review, skip, sort, source, take });
  }

  @Get('accounting-journal-batches/summary')
  accountingJournalBatchSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('source') source?: string,
  ) {
    return this.admin.accountingJournalBatchSummary({ period, q, range, review, source });
  }

  @Get('accounting-journal-batches/export')
  exportAccountingJournalBatches(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('source') source?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.exportAccountingJournalBatches({ period, q, range, review, sort, source });
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
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('age') age?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listBookingPaymentClearingEntries({
      age,
      assigneeAdminId,
      assignment,
      range,
      review,
      q,
      skip,
      sort,
      take,
    });
  }

  @Get('booking-payment-clearing/summary')
  bookingPaymentClearingSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('age') age?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.bookingPaymentClearingSummary({
      age,
      assigneeAdminId,
      assignment,
      range,
      review,
      q,
    });
  }

  @Get('booking-payment-clearing/review-owner-summary')
  bookingPaymentClearingReviewOwnerSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('age') age?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.bookingPaymentClearingReviewOwnerSummary({ age, q, range, review });
  }

  @Post('booking-payment-clearing/review-assignments')
  assignBookingPaymentClearingReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignBookingPaymentClearingReviewsDto,
  ) {
    return this.admin.assignBookingPaymentClearingReviews(user.id, body);
  }

  @Get('booking-payment-clearing/:id')
  bookingPaymentClearingEntryDetail(@Param('id') id: string) {
    return this.admin.bookingPaymentClearingEntryDetail(id);
  }

  @Post('booking-payment-clearing/:id/review-assignment')
  assignBookingPaymentClearingReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignCompanyBankTransactionReviewDto,
  ) {
    return this.admin.assignBookingPaymentClearingReview(user.id, id, body);
  }
}
