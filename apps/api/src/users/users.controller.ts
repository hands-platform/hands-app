import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('app/session')
  @UseGuards(JwtAuthGuard)
  recordAppSession(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: { ip?: string },
    @Body()
    body: {
      role?: Role;
      deviceId?: string;
      platform?: string;
      appVersion?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.users.recordAppSession(user, body, request.ip);
  }

  @Get('customer/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  getCustomerMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.id);
  }

  @Patch('customer/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  updateCustomerMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { fullName?: string; email?: string },
  ) {
    return this.users.updateMe(user.id, body);
  }

  @Get(['partner/me', 'provider/me'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  getProviderMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.id);
  }

  @Patch(['partner/me', 'provider/me'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  updateProviderMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { fullName?: string; email?: string },
  ) {
    return this.users.updateMe(user.id, body);
  }
}
