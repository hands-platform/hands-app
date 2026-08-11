import { Get, Param, Query } from '@nestjs/common';

import { AdminBookingRoutes } from './admin-booking.routes';

export class AdminPaymentRoutes extends AdminBookingRoutes {
  @Get('payments')
  payments(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('bookingStatus') bookingStatus?: string,
    @Query('evidence') evidence?: string,
  ) {
    return this.admin.listPayments({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      range,
      review,
      sla,
      skip,
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(bookingStatus ? { bookingStatus } : {}),
      ...(evidence ? { evidence } : {}),
      take,
    });
  }

  @Get('payments/summary')
  paymentSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('bookingStatus') bookingStatus?: string,
    @Query('evidence') evidence?: string,
  ) {
    return this.admin.paymentSummary({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      range,
      review,
      sla,
      ...(q ? { q } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(bookingStatus ? { bookingStatus } : {}),
      ...(evidence ? { evidence } : {}),
    });
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
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listPaymentCallbackAttempts({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      range,
      review,
      ...(sort ? { sort } : {}),
      take,
    });
  }

  @Get('refunds')
  refunds(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listRefunds({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      range,
      review,
      sla,
      skip,
      ...(sort ? { sort } : {}),
      ...(q ? { q } : {}),
      take,
    });
  }

  @Get('refunds/queue-meta')
  refundQueueMeta(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.refundQueueMeta({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      ...(q ? { q } : {}),
      range,
      review,
      sla,
    });
  }

  @Get('refunds/summary')
  refundSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('customerProfileId') customerProfileId?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.refundSummary({
      ...(age ? { age } : {}),
      ...(customerProfileId ? { customerProfileId } : {}),
      range,
      review,
      ...(q ? { q } : {}),
      sla,
    });
  }
}
