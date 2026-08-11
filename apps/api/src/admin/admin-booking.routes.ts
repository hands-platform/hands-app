import { Body, Get, Param, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  BookingCloseoutDto,
  BookingOpsNoteDto,
  BookingOpsReasonDto,
  BookingOpsTaskDto,
  BookingPostMatchCancellationDecisionDto,
} from './admin.dto';
import { AdminPartnerRoutes } from './admin-partner.routes';

export class AdminBookingRoutes extends AdminPartnerRoutes {
  @Get('bookings')
  bookings(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('q') q?: string,
    @Query('statusGroup') statusGroup?: string,
    @Query('sort') sort?: string,
    @Query('take') take?: string,
    @Query('age') age?: string,
    @Query('cancellationReason') cancellationReason?: string,
  ) {
    return this.admin.listBookings({
      ...(age ? { age } : {}),
      cancellationReason,
      dateFrom,
      dateRange,
      dateTo,
      q,
      sort,
      statusGroup,
      take,
    });
  }

  @Get('bookings/page')
  bookingsPage(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('statusGroup') statusGroup?: string,
    @Query('sort') sort?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('cancellationReason') cancellationReason?: string,
  ) {
    return this.admin.listBookingsPage({
      ...(age ? { age } : {}),
      cancellationReason,
      dateFrom,
      dateRange,
      dateTo,
      page,
      pageSize,
      q,
      sort,
      sla,
      statusGroup,
    });
  }

  @Get('bookings/summary')
  bookingsSummary() {
    return this.admin.bookingMonitorSummary();
  }

  @Get('bookings/completed-operations-summary')
  completedBookingOperationsSummary(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('q') q?: string,
    @Query('age') age?: string,
  ) {
    return this.admin.completedBookingOperationsSummary({
      ...(age ? { age } : {}),
      dateFrom,
      dateRange,
      dateTo,
      q,
    });
  }

  @Get('bookings/post-match-cancellations-summary')
  postMatchCancellationOperationsSummary(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('q') q?: string,
    @Query('age') age?: string,
    @Query('cancellationReason') cancellationReason?: string,
  ) {
    return this.admin.postMatchCancellationOperationsSummary({
      ...(age ? { age } : {}),
      cancellationReason,
      dateFrom,
      dateRange,
      dateTo,
      q,
    });
  }

  @Get('chat-archive')
  chatArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('sender') sender?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listChatArchive({
      dateFrom,
      dateRange,
      dateTo,
      q,
      sender,
      skip,
      sort,
      status,
      take,
    }, user);
  }

  @Get('chat-archive/summary')
  chatArchiveSummary(
    @Query('dateRange') dateRange?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('sender') sender?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.chatArchiveSummary({ dateFrom, dateRange, dateTo, q, sender, status });
  }

  @Get('bookings/:id/notifications')
  bookingNotifications(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.listBookingNotifications(id, { take });
  }

  @Get('bookings/:id/chat-messages')
  bookingChatMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.listBookingChatMessages(id, user);
  }

  @Get('bookings/:id/marketplace-providers')
  bookingMarketplaceProviders(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.listBookingMarketplaceProviders(id, { take });
  }

  @Get('bookings/:id')
  bookingDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('includeDiagnostics') includeDiagnostics?: string,
  ) {
    return this.admin.getBookingDetail(id, {
      includeDiagnostics: includeDiagnostics !== 'false',
      viewer: user,
    });
  }

  @Post('bookings/:id/ops-note')
  addBookingOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsNoteDto,
  ) {
    return this.admin.addBookingOpsNote(user.id, id, body);
  }

  @Post('bookings/:id/repair-chat-room')
  repairBookingChatRoom(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.repairBookingChatRoom(user.id, id);
  }

  @Post('bookings/:id/no-show')
  markBookingNoShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsReasonDto,
  ) {
    return this.admin.markBookingNoShow(user.id, id, body);
  }

  @Post('bookings/:id/expire')
  expireBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsReasonDto,
  ) {
    return this.admin.expireBooking(user.id, id, body);
  }

  @Post('bookings/:id/closeout')
  closeoutCompletedBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingCloseoutDto,
  ) {
    return this.admin.closeoutCompletedBooking(user.id, id, body);
  }

  @Post('bookings/:id/post-match-cancellation/approve')
  approvePostMatchCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingPostMatchCancellationDecisionDto,
  ) {
    return this.admin.approvePostMatchCancellation(user.id, id, body);
  }

  @Post('bookings/:id/post-match-cancellation/hold')
  holdPostMatchCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingPostMatchCancellationDecisionDto,
  ) {
    return this.admin.holdPostMatchCancellation(user.id, id, body);
  }

  @Post('bookings/:id/ops-task')
  updateBookingOpsTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: BookingOpsTaskDto,
  ) {
    return this.admin.updateBookingOpsTask(user.id, id, body);
  }
}
