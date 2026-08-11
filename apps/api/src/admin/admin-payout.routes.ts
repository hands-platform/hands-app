import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreatePayoutBatchDto,
  ReversePaidDisbursementDto,
  UpdatePayoutBatchDto,
  UpdateProviderWalletWithdrawalRequestDto,
} from './admin.dto';
import { AdminWalletRoutes } from './admin-wallet.routes';

export class AdminPayoutRoutes extends AdminWalletRoutes {
  @Get('provider-wallet/withdrawal-requests')
  providerWalletWithdrawalRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('status') status?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('reconciliation') reconciliation?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listProviderWalletWithdrawalRequests(
      {
        providerProfileId,
        range,
        reconciliation,
        q,
        skip,
        sort,
        status,
        take,
      },
      user.id,
    );
  }

  @Get('provider-wallet/withdrawal-requests/summary')
  providerWalletWithdrawalRequestSummary(
    @Query('range') range?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('reconciliation') reconciliation?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.providerWalletWithdrawalRequestSummary({
      providerProfileId,
      q,
      range,
      reconciliation,
      status,
    });
  }

  @Patch('provider-wallet/withdrawal-requests/:id')
  updateProviderWalletWithdrawalRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateProviderWalletWithdrawalRequestDto,
  ) {
    return this.admin.updateProviderWalletWithdrawalRequest(user.id, id, body);
  }

  @Post('provider-wallet/withdrawal-requests/:id/reversal')
  reversePaidProviderWalletWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReversePaidDisbursementDto,
  ) {
    return this.admin.reversePaidProviderWalletWithdrawal(user.id, id, body);
  }

  @Get('payout-batches/summary')
  payoutBatchSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('evidence') evidence?: string,
    @Query('q') q?: string,
    @Query('queue') queue?: string,
    @Query('status') status?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.payoutBatchSummary({
      evidence,
      ...(period ? { period } : {}),
      q,
      queue,
      range,
      review,
      status,
    });
  }

  @Get('payout-batches')
  payoutBatches(
    @CurrentUser() user: AuthenticatedUser,
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('view') view?: string,
    @Query('evidence') evidence?: string,
    @Query('q') q?: string,
    @Query('queue') queue?: string,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.listPayoutBatches(
      {
        evidence,
        ...(period ? { period } : {}),
        q,
        queue,
        range,
        review,
        skip,
        sort,
        status,
        take,
        view,
      },
      user.id,
    );
  }

  @Post('payout-batches')
  createPayoutBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePayoutBatchDto) {
    return this.admin.createPayoutBatch(user.id, body);
  }

  @Get('payout-batches/:id')
  payoutBatch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.getPayoutBatch(id, user.id);
  }

  @Patch('payout-batches/:id')
  updatePayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdatePayoutBatchDto,
  ) {
    return this.admin.updatePayoutBatch(user.id, id, body);
  }

  @Post('payout-batches/:id/reversal')
  reversePaidPayoutBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReversePaidDisbursementDto,
  ) {
    return this.admin.reversePaidPayoutBatch(user.id, id, body);
  }
}
