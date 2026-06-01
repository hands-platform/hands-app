import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomersService } from './customers.service';

@Controller('customer')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('coupons/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  previewCoupon(
    @Body() body: { code: string; serviceId: string; subtotal: number },
  ) {
    return this.customers.previewCoupon(body);
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { bookingId: string; rating: number; comment?: string },
  ) {
    return this.customers.createReview(user.id, body);
  }
}
