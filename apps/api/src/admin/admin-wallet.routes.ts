import { Body, Get, Header, Param, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AllocatePartnerBankDepositCashDebtDto,
  AssignCompanyBankTransactionReviewDto,
  AssignPartnerBankDepositReconciliationReviewsDto,
  CancelManualWalletAdjustmentRequestDto,
  CreateManualWalletAdjustmentDto,
  CreateManualWalletAdjustmentRequestDto,
  CreatePartnerBankDepositRequestDto,
  PreviewManualWalletAdjustmentDto,
  RecordPartnerBankDepositDto,
  RejectManualWalletAdjustmentRequestDto,
  RejectPartnerBankDepositRequestDto,
} from './admin.dto';
import { AdminBankRoutes } from './admin-bank.routes';

export class AdminWalletRoutes extends AdminBankRoutes {
  @Post('provider-wallet/deposits')
  @Header('X-HANDS-Deprecated', 'true')
  @Header('X-HANDS-Successor-Path', '/api/admin/provider-wallet/deposit-requests')
  /** @deprecated Use the persistent deposit request route followed by a separate approver decision. */
  recordPartnerBankDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPartnerBankDepositDto,
  ) {
    return this.admin.approvePartnerBankDepositFromLegacyRoute(user.id, body);
  }

  @Get('provider-wallet/deposit-requests')
  partnerBankDepositRequests(
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerBankDepositRequests({ skip, status, take });
  }

  @Get('provider-wallet/deposit-requests/history')
  partnerBankDepositRequestHistory(
    @Query('status') status?: string,
    @Query('review') review?: string,
    @Query('owner') owner?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('sla') sla?: string,
    @Query('period') period?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listPartnerBankDepositRequestHistory({
      assigneeAdminId,
      owner,
      period,
      q,
      review,
      skip,
      sla,
      status,
      take,
    });
  }

  @Get('provider-wallet/deposit-requests/reconciliation-owner-summary')
  partnerBankDepositReconciliationOwnerSummary(
    @Query('status') status?: string,
    @Query('sla') sla?: string,
    @Query('period') period?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.partnerBankDepositReconciliationOwnerSummary({
      period,
      q,
      sla,
      status,
    });
  }

  @Post('provider-wallet/deposit-requests/reconciliation-assignments')
  assignPartnerBankDepositReconciliationReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignPartnerBankDepositReconciliationReviewsDto,
  ) {
    return this.admin.assignPartnerBankDepositReconciliationReviews(user.id, body);
  }

  @Get('provider-wallet/deposit-requests/:id')
  partnerBankDepositRequestDetail(@Param('id') id: string) {
    return this.admin.getPartnerBankDepositRequestDetail(id);
  }

  @Post('provider-wallet/deposit-requests')
  createPartnerBankDepositRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePartnerBankDepositRequestDto,
  ) {
    return this.admin.createPartnerBankDepositRequest(user.id, body);
  }

  @Post('provider-wallet/deposit-requests/:id/approve')
  approvePartnerBankDepositRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.approvePartnerBankDepositRequest(user.id, id);
  }

  @Post('provider-wallet/deposit-requests/:id/reject')
  rejectPartnerBankDepositRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectPartnerBankDepositRequestDto,
  ) {
    return this.admin.rejectPartnerBankDepositRequest(user.id, id, body.reason);
  }

  @Post('provider-wallet/deposit-requests/:id/reconciliation-assignment')
  assignPartnerBankDepositReconciliationReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignCompanyBankTransactionReviewDto,
  ) {
    return this.admin.assignPartnerBankDepositReconciliationReview(user.id, id, body);
  }

  @Post('provider-wallet/deposit-requests/:id/cash-debt-allocations')
  allocatePartnerBankDepositCashDebt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AllocatePartnerBankDepositCashDebtDto,
  ) {
    return this.admin.allocatePartnerBankDepositCashDebt(user.id, id, body);
  }

  @Get('wallet-adjustments')
  manualWalletAdjustments(
    @Query('take') take?: string,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('periodMissing') periodMissing?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adjustmentType') adjustmentType?: string,
    @Query('direction') direction?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
    @Query('makerId') makerId?: string,
    @Query('approverId') approverId?: string,
    @Query('evidence') evidence?: string,
    @Query('sort') sort?: string,
  ) {
    return this.admin.listManualWalletAdjustments({
      adjustmentType, amountMax, amountMin, approverId, direction, evidence, from, makerId,
      ownerId, ownerType, period, periodMissing, q, skip, sort, take, to,
    });
  }

  @Get('wallet-adjustments/summary')
  manualWalletAdjustmentSummary(
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('periodMissing') periodMissing?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adjustmentType') adjustmentType?: string,
    @Query('direction') direction?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
    @Query('makerId') makerId?: string,
    @Query('approverId') approverId?: string,
    @Query('evidence') evidence?: string,
  ) {
    return this.admin.manualWalletAdjustmentSummary({
      adjustmentType, amountMax, amountMin, approverId, direction, evidence, from, makerId,
      ownerId, ownerType, period, periodMissing, q, to,
    });
  }

  @Get('wallet-adjustments/policy')
  manualWalletAdjustmentPolicy() {
    return this.admin.manualWalletAdjustmentPolicy();
  }

  @Get('wallet-adjustments/open-periods')
  manualWalletAdjustmentOpenPeriods() {
    return this.admin.manualWalletAdjustmentOpenPeriods();
  }

  @Get('wallet-adjustments/owners')
  manualWalletAdjustmentOwners(
    @Query('ownerType') ownerType?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.searchManualWalletAdjustmentOwners({ ownerType, q, take });
  }

  @Post('wallet-adjustments/preview')
  previewManualWalletAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PreviewManualWalletAdjustmentDto,
  ) {
    return this.admin.previewManualWalletAdjustment(user.id, body);
  }

  @Post('wallet-adjustments')
  @Header('X-HANDS-Deprecated', 'true')
  @Header('X-HANDS-Successor-Path', '/api/admin/wallet-adjustment-requests')
  /** @deprecated Use POST /api/admin/wallet-adjustment-requests followed by a separate approver decision. */
  createManualWalletAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateManualWalletAdjustmentDto,
  ) {
    return this.admin.approveManualWalletAdjustmentFromLegacyRoute(user.id, body);
  }

  @Get('wallet-adjustment-requests')
  manualWalletAdjustmentRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('review') review?: string,
    @Query('sort') sort?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('periodMissing') periodMissing?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adjustmentType') adjustmentType?: string,
    @Query('direction') direction?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
    @Query('makerId') makerId?: string,
    @Query('evidence') evidence?: string,
    @Query('age') age?: string,
    @Query('blocker') blocker?: string,
  ) {
    return this.admin.listManualWalletAdjustmentRequests(
      {
        adjustmentType, age, amountMax, amountMin, blocker, direction, evidence, from, makerId,
        ownerId, ownerType, period, periodMissing, q, review, skip, sort, status, take, to,
      },
      user.id,
    );
  }

  @Get('wallet-adjustment-requests/workspace-summary')
  manualWalletAdjustmentRequestWorkspaceSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.manualWalletAdjustmentRequestWorkspaceSummary(user.id);
  }

  @Get('wallet-adjustment-requests/summary')
  manualWalletAdjustmentRequestSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('periodMissing') periodMissing?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adjustmentType') adjustmentType?: string,
    @Query('direction') direction?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
    @Query('makerId') makerId?: string,
    @Query('evidence') evidence?: string,
    @Query('age') age?: string,
    @Query('blocker') blocker?: string,
  ) {
    return this.admin.manualWalletAdjustmentRequestSummary(
      {
        adjustmentType, age, amountMax, amountMin, blocker, direction, evidence, from, makerId,
        ownerId, ownerType, period, periodMissing, q, review, status, to,
      },
      user.id,
    );
  }

  @Get('wallet-adjustment-requests/:id')
  manualWalletAdjustmentRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.manualWalletAdjustmentRequest(id, user.id);
  }

  @Post('wallet-adjustment-requests')
  createManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateManualWalletAdjustmentRequestDto,
  ) {
    return this.admin.createManualWalletAdjustmentRequest(user.id, body);
  }

  @Post('wallet-adjustment-requests/:id/approve')
  approveManualWalletAdjustmentRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.admin.approveManualWalletAdjustmentRequest(user.id, id);
  }

  @Post('wallet-adjustment-requests/:id/reject')
  rejectManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: RejectManualWalletAdjustmentRequestDto,
  ) {
    return this.admin.rejectManualWalletAdjustmentRequest(user.id, id, body.reason);
  }

  @Post('wallet-adjustment-requests/:id/cancel-stale')
  cancelStaleManualWalletAdjustmentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelManualWalletAdjustmentRequestDto,
  ) {
    return this.admin.cancelStaleManualWalletAdjustmentRequest(user.id, id, body.reason);
  }
}
