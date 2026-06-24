import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GetMobileAppVersionDto, RegisterMobileDeviceDto, UnregisterMobileDeviceDto } from './mobile.dto';
import { MobileService } from './mobile.service';

@Controller('mobile')
export class MobileController {
  constructor(private readonly mobile: MobileService) {}

  @Get('app-version')
  getAppVersion(@Query() query: GetMobileAppVersionDto) {
    return this.mobile.getAppVersion(query);
  }

  @Post('devices/register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.PROVIDER)
  registerDevice(@CurrentUser() user: AuthenticatedUser, @Body() body: RegisterMobileDeviceDto) {
    return this.mobile.registerDevice(user, body);
  }

  @Delete('devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.PROVIDER)
  unregisterDevice(@CurrentUser() user: AuthenticatedUser, @Body() body: UnregisterMobileDeviceDto) {
    return this.mobile.unregisterDevice(user, body);
  }
}
