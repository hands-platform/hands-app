import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BookingStatus, ParticipantStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CancelProviderBookingDto, CreateCustomerBookingDto, SelectBookingProviderDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('customer/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createCustomerBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCustomerBookingDto,
  ) {
    return this.bookings.createOpenMatchingBooking(user.id, body);
  }

  @Get('customer/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  listCustomerBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.listCustomerBookings(user.id);
  }

  @Get('customer/bookings/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  getCustomerBooking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.getCustomerBooking(id, user.id);
  }

  @Post('customer/bookings/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  cancelCustomerBooking(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.cancelCustomerBooking(bookingId, user.id);
  }

  @Post('customer/bookings/:id/select-provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  selectProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() body: SelectBookingProviderDto,
  ) {
    return this.bookings.selectProvider(bookingId, user.id, body.providerId);
  }

  @Get(['partner/bookings/open', 'provider/bookings/open'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  getOpenBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.getOpenBookings(user.id);
  }

  @Get(['partner/bookings', 'provider/bookings'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  listProviderBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.listProviderBookings(user.id);
  }

  @Post(['partner/bookings/:id/join', 'provider/bookings/:id/join'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  join(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.joinBooking(bookingId, user.id);
  }

  @Post(['partner/bookings/:id/accept', 'provider/bookings/:id/accept'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.updateParticipant(bookingId, user.id, ParticipantStatus.ACCEPTED);
  }

  @Post(['partner/bookings/:id/reject', 'provider/bookings/:id/reject'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.updateParticipant(bookingId, user.id, ParticipantStatus.REJECTED);
  }

  @Post(['partner/bookings/:id/arrived', 'provider/bookings/:id/arrived'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  arrived(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.updateProviderBookingStatus(bookingId, user.id, BookingStatus.ARRIVED);
  }

  @Post(['partner/bookings/:id/start', 'provider/bookings/:id/start'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.updateProviderBookingStatus(bookingId, user.id, BookingStatus.IN_SERVICE);
  }

  @Post(['partner/bookings/:id/complete', 'provider/bookings/:id/complete'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') bookingId: string) {
    return this.bookings.complete(bookingId, user.id);
  }

  @Post(['partner/bookings/:id/cancel', 'provider/bookings/:id/cancel'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  cancelProviderBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() body: CancelProviderBookingDto,
  ) {
    return this.bookings.cancelProviderBooking(bookingId, user.id, body);
  }
}
