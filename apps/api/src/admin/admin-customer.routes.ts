import { Body, Get, Param, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerOpsNoteDto } from './admin.dto';
import { AdminService } from './admin.service';

export class AdminCustomerRoutes {
  constructor(protected readonly admin: AdminService) {}

  @Get('customers')
  customers(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
    @Query('joinedFrom') joinedFrom?: string,
    @Query('joinedTo') joinedTo?: string,
    @Query('lastBookingFrom') lastBookingFrom?: string,
    @Query('lastBookingTo') lastBookingTo?: string,
    @Query('lastLoginFrom') lastLoginFrom?: string,
    @Query('lastLoginTo') lastLoginTo?: string,
    @Query('sort') sort?: string,
    @Query('view') view?: string,
    @Query('segment') segment?: string,
  ) {
    return this.admin.listCustomers({
      country,
      gender,
      joinedFrom,
      joinedTo,
      lastBookingFrom,
      lastBookingTo,
      lastLoginFrom,
      lastLoginTo,
      q,
      skip,
      sort,
      take,
      view,
      segment,
    });
  }

  @Get('customers/summary')
  customerSummary(
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
    @Query('joinedFrom') joinedFrom?: string,
    @Query('joinedTo') joinedTo?: string,
    @Query('lastBookingFrom') lastBookingFrom?: string,
    @Query('lastBookingTo') lastBookingTo?: string,
    @Query('lastLoginFrom') lastLoginFrom?: string,
    @Query('lastLoginTo') lastLoginTo?: string,
    @Query('view') view?: string,
    @Query('segment') segment?: string,
  ) {
    return this.admin.customerSummary({
      country,
      gender,
      joinedFrom,
      joinedTo,
      lastBookingFrom,
      lastBookingTo,
      lastLoginFrom,
      lastLoginTo,
      q,
      view,
      segment,
    });
  }

  @Get('customers/:id')
  customerDetail(
    @Param('id') customerProfileId: string,
    @Query('includeDiagnostics') includeDiagnostics?: string,
  ) {
    return this.admin.getCustomerDetail(customerProfileId, {
      includeDiagnostics: includeDiagnostics === 'true',
    });
  }

  @Get('customers/:id/wallet-ledger')
  customerWalletLedger(
    @Param('id') customerProfileId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('currency') currency?: string,
  ) {
    return this.admin.getCustomerWalletLedger(customerProfileId, { currency, skip, take });
  }

  @Post('customers/:id/ops-note')
  addCustomerOpsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') customerProfileId: string,
    @Body() body: CustomerOpsNoteDto,
  ) {
    return this.admin.addCustomerOpsNote(user.id, customerProfileId, body);
  }
}
