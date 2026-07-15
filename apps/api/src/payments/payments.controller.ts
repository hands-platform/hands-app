import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentMethod, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RefundPaymentDto } from './payments.dto';
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

  @Post('admin/payments/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.payments.refund(user.id, paymentId, body);
  }

  @Post('admin/payments/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  sync(@CurrentUser() user: AuthenticatedUser, @Param('id') paymentId: string) {
    return this.payments.syncStatusForAdmin(user.id, paymentId);
  }

  @Post('admin/payments/:id/capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  capture(@CurrentUser() user: AuthenticatedUser, @Param('id') paymentId: string) {
    return this.payments.capture(user.id, paymentId);
  }

  @Post('admin/payments/:id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  release(@CurrentUser() user: AuthenticatedUser, @Param('id') paymentId: string) {
    return this.payments.releaseForAdmin(user.id, paymentId);
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
