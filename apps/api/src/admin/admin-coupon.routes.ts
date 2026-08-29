import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CouponStateChangeDto,
  CreateCouponBatchDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './admin.dto';
import { AdminReviewRoutes } from './admin-review.routes';
import { assertCouponLaunchEnabled } from '../common/launch-features';

export class AdminCouponRoutes extends AdminReviewRoutes {
  @Get('coupons')
  coupons(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('state') state?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listCoupons({ q, skip, sort, state, take });
  }

  @Get('coupons/summary')
  couponSummary(@Query('state') state?: string, @Query('q') q?: string) {
    return this.admin.couponSummary({ q, state });
  }

  @Get('coupons/:id/usage')
  couponUsage(@Param('id') id: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listCouponUsageBookings(id, { skip, take });
  }

  @Get('coupons/:id')
  coupon(@Param('id') id: string) {
    return this.admin.getCoupon(id);
  }

  @Post('coupons/batch')
  createCouponBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCouponBatchDto) {
    assertCouponLaunchEnabled();
    return this.admin.createCouponBatch(user.id, body.coupons);
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCouponDto) {
    assertCouponLaunchEnabled();
    return this.admin.createCoupon(user.id, body);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCouponDto,
  ) {
    assertCouponLaunchEnabled();
    return this.admin.updateCoupon(user.id, id, body);
  }

  @Post('coupons/:id/activate')
  activateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CouponStateChangeDto,
  ) {
    assertCouponLaunchEnabled();
    return this.admin.activateCoupon(user.id, id, body.reason);
  }

  @Post('coupons/:id/pause')
  pauseCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CouponStateChangeDto,
  ) {
    assertCouponLaunchEnabled();
    return this.admin.pauseCoupon(user.id, id, body.reason);
  }

  @Delete('coupons/:id')
  deleteCoupon(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    assertCouponLaunchEnabled();
    return this.admin.deleteCoupon(user.id, id);
  }
}
