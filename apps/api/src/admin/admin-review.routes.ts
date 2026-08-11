import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateAdminPartnerReviewDto,
  ModeratePartnerCustomerReviewDto,
  ModerateReviewDto,
} from './admin.dto';
import { AdminPayoutRoutes } from './admin-payout.routes';

export class AdminReviewRoutes extends AdminPayoutRoutes {
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

  @Get('reviews/:id')
  review(@Param('id') id: string) {
    return this.admin.getReview(id);
  }

  @Get('partner-customer-reviews')
  partnerCustomerReviews(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
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
      status,
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

  @Get('partner-customer-reviews/:id')
  partnerCustomerReview(@Param('id') id: string) {
    return this.admin.getPartnerCustomerReview(id);
  }

  @Patch('partner-customer-reviews/:id/moderate')
  moderatePartnerCustomerReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ModeratePartnerCustomerReviewDto,
  ) {
    return this.admin.moderatePartnerCustomerReview(user.id, id, body);
  }

  @Post('reviews/manual')
  createManualPartnerReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAdminPartnerReviewDto,
  ) {
    return this.admin.createManualPartnerReview(user.id, body);
  }

  @Patch('reviews/:id/moderate')
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ModerateReviewDto,
  ) {
    return this.admin.moderateReview(user.id, id, body);
  }
}
