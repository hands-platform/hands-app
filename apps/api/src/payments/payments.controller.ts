import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentMethod, Role } from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminPaymentActionDto, RejectRefundPaymentDto, RequestRefundPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('customer/payment-methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerPaymentMethods() {
    return this.payments.customerCheckoutMethods();
  }

  @Get('customer/bookings/:bookingId/payment-action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  customerPaymentAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.payments.customerCheckoutAction(user.id, bookingId);
  }

  @Post('admin/payments/:id/refund-request')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body: RequestRefundPaymentDto,
  ) {
    return this.payments.requestRefundForAdmin(user.id, paymentId, body);
  }

  @Post('admin/payments/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
  ) {
    return this.payments.refund(user.id, paymentId);
  }

  @Post('admin/refunds/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  rejectRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') refundId: string,
    @Body() body: RejectRefundPaymentDto,
  ) {
    return this.payments.rejectRefund(user.id, refundId, body.reason);
  }

  @Post('admin/payments/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body: AdminPaymentActionDto,
  ) {
    return this.payments.syncStatusForAdmin(user.id, paymentId, body);
  }

  @Post('admin/payments/:id/capture')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  capture(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body: AdminPaymentActionDto,
  ) {
    return this.payments.captureForAdmin(user.id, paymentId, body);
  }

  @Post('admin/payments/:id/release')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  release(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body: AdminPaymentActionDto,
  ) {
    return this.payments.releaseForAdmin(user.id, paymentId, body);
  }

  @Post('payments/:method/callback')
  callback(@Param('method', new ParseEnumPipe(PaymentMethod)) method: PaymentMethod, @Body() body: unknown) {
    return this.payments.handleCallback(method, body);
  }

  @Get('payments/VNPAY/callback')
  vnpayIpn(@Query() query: Record<string, unknown>) {
    return this.payments.handleVnpayIpn(query);
  }
}
