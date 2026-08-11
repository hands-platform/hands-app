import { Body, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ActivatePaymentFeePolicyVersionDto,
  AllocateCashSettlementDebtDto,
  ClosePaymentFeePolicyApprovalDto,
  CreatePaymentFeePolicyVersionDto,
  MarkEarningPaidDto,
  RequestPaymentFeePolicyApprovalDto,
  UpdateMonthlyTaxClosingStatusDto,
  UpdatePaymentFeePolicyVersionDto,
  UpsertPaymentFeeRuleDto,
} from './admin.dto';
import { AdminReferralRoutes } from './admin-referral.routes';

export class AdminFinanceRoutes extends AdminReferralRoutes {
  @Get('finance-overview')
  financeOverviewSummary(@Query('range') range?: string, @Query('period') period?: string) {
    return this.admin.financeOverviewSummary({ period, range });
  }

  @Get('earnings')
  earnings(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listEarnings({ range, review, skip, take });
  }

  @Get('cash-settlement-earnings')
  cashSettlementEarnings(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('queue') queue?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('age') age?: string,
    @Query('sort') sort?: string,
    @Query('sla') sla?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.listCashSettlementEarnings({
      ...(age ? { age } : {}),
      q,
      queue,
      range,
      ...(period ? { period } : {}),
      sla,
      skip,
      ...(sort ? { sort } : {}),
      take,
    });
  }

  @Get('cash-settlement-earnings/:id')
  cashSettlementEarning(@Param('id') id: string) {
    return this.admin.cashSettlementEarningDetail(id);
  }

  @Post('cash-settlement-earnings/:id/allocations')
  allocateCashSettlementDebt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AllocateCashSettlementDebtDto,
  ) {
    return this.admin.allocatePartnerBankDepositCashDebt(user.id, body.requestId, {
      amount: body.amount,
      earningId: id,
      notes: body.notes,
      reasonCode: body.reasonCode,
    });
  }

  @Get('cash-settlement-summary')
  cashSettlementSummary(
    @Query('range') range?: string,
    @Query('queue') queue?: string,
    @Query('q') q?: string,
    @Query('age') age?: string,
    @Query('sla') sla?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.cashSettlementSummary({
      ...(age ? { age } : {}),
      ...(period ? { period } : {}),
      q,
      queue,
      range,
      sla,
    });
  }

  @Get('earnings/summary')
  earningsSummary(@Query('range') range?: string, @Query('review') review?: string) {
    return this.admin.earningsSummary({ range, review });
  }

  @Get('partner-withholding-tax')
  partnerWithholdingTax(
    @Query('period') period?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerWithholdingTax({ period, skip, take });
  }

  @Get('partner-withholding-tax/summary')
  partnerWithholdingTaxSummary(@Query('period') period?: string) {
    return this.admin.partnerWithholdingTaxSummary({ period });
  }

  @Get('monthly-tax-closings')
  monthlyTaxClosings(
    @Query('period') period?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listMonthlyTaxClosings({ period, skip, take });
  }

  @Get('monthly-tax-closings/summary')
  monthlyTaxClosingSummary(@Query('period') period?: string) {
    return this.admin.monthlyTaxClosingSummary({ period });
  }

  @Patch('monthly-tax-closings/:period/status')
  updateMonthlyTaxClosingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('period') period: string,
    @Body() body: UpdateMonthlyTaxClosingStatusDto,
  ) {
    return this.admin.updateMonthlyTaxClosingStatus(user.id, period, body);
  }

  @Get('platform-vat/summary')
  platformVatSummary(@Query('period') period?: string) {
    return this.admin.platformVatSummary({ period });
  }

  @Get('payment-fees/summary')
  paymentFeeSummary(@Query('period') period?: string) {
    return this.admin.paymentFeeSummary({ period });
  }

  @Get('payment-fee-policies')
  paymentFeePolicies(@Query('take') take?: string) {
    return this.admin.listPaymentFeePolicies({ take });
  }

  @Get('payment-fee-policies/:id/preflight')
  paymentFeePolicyPreflight(@Param('id') id: string, @Query('sampleAmount') sampleAmount?: string) {
    return this.admin.paymentFeePolicyPreflight(id, { sampleAmount });
  }

  @Get('payment-fee-policies/:id/approval')
  paymentFeePolicyApproval(@Param('id') id: string) {
    return this.admin.paymentFeePolicyApproval(id);
  }

  @Post('payment-fee-policies')
  createPaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentFeePolicyVersionDto,
  ) {
    return this.admin.createPaymentFeePolicy(user.id, body);
  }

  @Patch('payment-fee-policies/:id')
  updatePaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdatePaymentFeePolicyVersionDto,
  ) {
    return this.admin.updatePaymentFeePolicy(user.id, id, body);
  }

  @Post('payment-fee-policies/:id/rules')
  upsertPaymentFeeRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpsertPaymentFeeRuleDto,
  ) {
    return this.admin.upsertPaymentFeeRule(user.id, id, body);
  }

  @Post('payment-fee-policies/:id/approval-request')
  requestPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RequestPaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.requestPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/approval-reject')
  rejectPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ClosePaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.rejectPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/approval-cancel')
  cancelPaymentFeePolicyApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ClosePaymentFeePolicyApprovalDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.cancelPaymentFeePolicyApproval(user.id, id, body, operatorIdentity);
  }

  @Post('payment-fee-policies/:id/activate')
  activatePaymentFeePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ActivatePaymentFeePolicyVersionDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.admin.activatePaymentFeePolicy(user.id, id, body, operatorIdentity);
  }

  @Post('earnings/:id/mark-paid')
  markEarningPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MarkEarningPaidDto,
  ) {
    return this.admin.markEarningPaid(user.id, id, body);
  }

  @Get('finance-approval-queue')
  financeApprovalQueue(
    @Query('take') take?: string,
    @Query('walletReview') walletReview?: string,
    @Query('view') view?: string,
    @Query('review') review?: string,
    @Query('page') page?: string,
    @Query('requestId') requestId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const options = {
      take,
      ...(view ? { view } : {}),
      ...(review ? { review } : {}),
      ...(page ? { page } : {}),
      ...(requestId ? { requestId } : {}),
      ...(walletReview ? { walletReview } : {}),
    };
    return user?.id
      ? this.admin.financeApprovalQueue(options, user.id)
      : this.admin.financeApprovalQueue(options);
  }
}
