import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateCustomerReviewDto,
  PreviewCouponDto,
  RecordProviderProfileViewDto,
  SetCustomerFavoriteProviderDto,
} from './customers.dto';
import { CustomersService } from './customers.service';
import { assertCouponLaunchEnabled } from '../common/launch-features';

@Controller('customer')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('coupons/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  previewCoupon(@Body() body: PreviewCouponDto) {
    assertCouponLaunchEnabled();
    return this.customers.previewCoupon(body);
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createReview(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCustomerReviewDto) {
    return this.customers.createReview(user.id, body);
  }

  @Get('partner-favorites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  listFavoriteProviders(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.listFavoriteProviders(user.id);
  }

  @Get('home-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  homeSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.customers.getHomeSummary(user.id, Number(lat), Number(lng));
  }

  @Get('wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  wallet(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.getWallet(user.id);
  }

  @Get('partner-profile-views')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  listViewedProviders(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.listViewedProviders(user.id);
  }

  @Post('partners/:providerId/view')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  recordProviderProfileView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
    @Body() body: RecordProviderProfileViewDto,
  ) {
    return this.customers.recordProviderProfileView(user.id, providerId, body.clientEventId);
  }

  @Post('partners/:providerId/favorite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  setFavoriteProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
    @Body() body: SetCustomerFavoriteProviderDto,
  ) {
    return this.customers.setFavoriteProvider(user.id, providerId, body.favorite ?? true);
  }
}
