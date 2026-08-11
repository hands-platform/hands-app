import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ProviderStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  RecordProviderDeviceSessionDto,
  SubmitProviderVerificationDto,
  UpdateProviderAvailabilityDto,
  UpdateProviderLocationDto,
  UpdateProviderProfileDto,
  UpdateProviderServicePriceDto,
} from './providers.dto';
import { ProvidersService } from './providers.service';

@Controller()
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get(['customer/partners/nearby', 'customer/providers/nearby'])
  nearby(@Query('lat') lat?: string, @Query('lng') lng?: string, @Query('take') take?: string) {
    return this.providers.findNearby(Number(lat), Number(lng), { take });
  }

  @Get('public/partners')
  publicDirectory(
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    return this.providers.listPublicDirectory({ city, district, page, take });
  }

  @Get(['customer/partners/:id', 'customer/providers/:id', 'public/partners/:id'])
  detail(@Param('id') id: string) {
    return this.providers.getDetail(id);
  }

  @Patch(['partner/me/profile', 'provider/me/profile'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  updateProviderProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProviderProfileDto,
  ) {
    return this.providers.updateProfile(user.id, body);
  }

  @Get(['partner/availability', 'provider/availability'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  availability(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.getAvailability(user.id);
  }

  @Put(['partner/availability', 'provider/availability'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProviderAvailabilityDto,
  ) {
    return this.providers.updateAvailability(user.id, body);
  }

  @Post(['partner/online', 'provider/online'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  online(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.setStatus(user.id, ProviderStatus.ONLINE_AVAILABLE);
  }

  @Post(['partner/device-session', 'provider/device-session'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  recordDeviceSession(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: { ip?: string },
    @Body() body: RecordProviderDeviceSessionDto,
  ) {
    return this.providers.recordDeviceSession(user.id, body, request.ip);
  }

  @Post(['partner/offline', 'provider/offline'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  offline(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.setStatus(user.id, ProviderStatus.OFFLINE);
  }

  @Post(['partner/location', 'provider/location'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  updateLocation(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProviderLocationDto) {
    return this.providers.updateLocation(user.id, body);
  }

  @Get(['partner/services', 'provider/services'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  services(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.listServices(user.id);
  }

  @Get(['partner/services/groups', 'provider/services/groups'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  serviceGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.listServiceGroups(user.id);
  }

  @Patch(['partner/services/:serviceId', 'provider/services/:serviceId'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  updateServicePrice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId') serviceId: string,
    @Body() body: UpdateProviderServicePriceDto,
  ) {
    return this.providers.updateServicePrice(user.id, serviceId, body);
  }

  @Get(['partner/verification', 'provider/verification'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  verification(@CurrentUser() user: AuthenticatedUser) {
    return this.providers.getVerification(user.id);
  }

  @Post(['partner/verification/submit', 'provider/verification/submit'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  submitVerification(@CurrentUser() user: AuthenticatedUser, @Body() body: SubmitProviderVerificationDto) {
    return this.providers.submitVerification(user.id, body);
  }
}
