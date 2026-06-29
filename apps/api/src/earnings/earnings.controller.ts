import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProviderWalletWithdrawalRequestDto } from './earnings.dto';
import { EarningsService } from './earnings.service';

@Controller(['provider/earnings', 'partner/earnings'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROVIDER)
export class EarningsController {
  constructor(private readonly earnings: EarningsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.earnings.listForProviderUser(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.earnings.summaryForProviderUser(user.id);
  }

  @Get('payout-batches')
  payoutBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.earnings.listPayoutBatchesForProviderUser(user.id);
  }

  @Get('wallet-withdrawal-requests')
  walletWithdrawalRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.earnings.listProviderWalletWithdrawalRequestsForProviderUser(user.id);
  }

  @Post('wallet-withdrawal-requests')
  createWalletWithdrawalRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateProviderWalletWithdrawalRequestDto,
  ) {
    return this.earnings.createProviderWalletWithdrawalRequestForProviderUser(user.id, body);
  }
}
