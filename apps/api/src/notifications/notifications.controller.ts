import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CustomerNotificationInboxQueryDto,
  DeleteDeviceTokenDto,
  ProviderChatNotificationReadDto,
  RegisterDeviceTokenDto,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listForUser(user.id);
  }

  @Get('customer-inbox')
  @Roles(Role.CUSTOMER)
  listCustomerInbox(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CustomerNotificationInboxQueryDto,
  ) {
    return this.notifications.listCustomerAppInbox(user.id, query);
  }

  @Get('provider-chat/summary')
  @Roles(Role.PROVIDER)
  providerChatSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.providerChatSummary(user.id);
  }

  @Patch('provider-chat/read')
  @Roles(Role.PROVIDER)
  markProviderChatRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ProviderChatNotificationReadDto,
  ) {
    return this.notifications.markProviderChatRead(user.id, body.chatRoomId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('device-token/register')
  @Roles(Role.CUSTOMER, Role.PROVIDER)
  registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDeviceTokenDto,
  ) {
    return this.notifications.registerDeviceToken(user, body);
  }

  @Post('device-token/register')
  @Roles(Role.CUSTOMER, Role.PROVIDER)
  registerDeviceTokenPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDeviceTokenDto,
  ) {
    return this.notifications.registerDeviceToken(user, body);
  }

  @Delete('device-token')
  @Roles(Role.CUSTOMER, Role.PROVIDER)
  disableDeviceToken(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteDeviceTokenDto) {
    return this.notifications.disableDeviceToken(user, body);
  }
}
