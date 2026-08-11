import { Body, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AssignCompanyBankTransactionImportBatchDto,
  AssignCompanyBankTransactionReviewDto,
  AssignCompanyBankTransactionReviewsDto,
  CreateBankReconciliationMatchDto,
  CreateCompanyBankAccountDto,
  CreateCompanyBankTransactionDto,
  DecideCompanyBankAccountChangeDto,
  IgnoreCompanyBankTransactionDto,
  ImportCompanyBankTransactionBatchDto,
  PreviewCompanyBankTransactionBatchDto,
  ReverseBankReconciliationMatchDto,
  UpdateCompanyBankAccountDto,
} from './admin.dto';
import { AdminLedgerRoutes } from './admin-ledger.routes';

export class AdminBankRoutes extends AdminLedgerRoutes {
  @Get('company-bank-accounts')
  companyBankAccounts(@Query('status') status?: string) {
    return this.admin.listCompanyBankAccounts({ status });
  }

  @Post('company-bank-accounts')
  createCompanyBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCompanyBankAccountDto,
  ) {
    return this.admin.createCompanyBankAccount(user.id, input);
  }

  @Patch('company-bank-accounts/:id')
  updateCompanyBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateCompanyBankAccountDto,
  ) {
    return this.admin.updateCompanyBankAccount(user.id, id, input);
  }

  @Post('company-bank-accounts/:id/approval-decision')
  decideCompanyBankAccountChange(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: DecideCompanyBankAccountChangeDto,
  ) {
    return this.admin.decideCompanyBankAccountChange(user.id, id, input);
  }

  @Get('bank-reconciliation')
  bankReconciliationTransactions(
    @Query('take') take?: string,
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('age') age?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.listBankReconciliationTransactions({
      age,
      assigneeAdminId,
      assignment,
      candidate,
      period,
      q,
      range,
      review,
      skip,
      take,
      type,
      source,
    });
  }

  @Get('bank-reconciliation/summary')
  bankReconciliationSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('age') age?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.bankReconciliationSummary({
      age,
      assigneeAdminId,
      assignment,
      candidate,
      period,
      q,
      range,
      review,
      type,
      source,
    });
  }

  @Get('bank-reconciliation/evidence-source-summary')
  bankReconciliationEvidenceSourceSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('assignment') assignment?: string,
    @Query('assigneeAdminId') assigneeAdminId?: string,
    @Query('type') type?: string,
    @Query('age') age?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.bankReconciliationEvidenceSourceSummary({
      age,
      assigneeAdminId,
      assignment,
      candidate,
      period,
      q,
      range,
      review,
      type,
    });
  }

  @Get('bank-reconciliation/review-owner-summary')
  bankReconciliationReviewOwnerSummary(
    @Query('range') range?: string,
    @Query('review') review?: string,
    @Query('q') q?: string,
    @Query('candidate') candidate?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('age') age?: string,
    @Query('period') period?: string,
  ) {
    return this.admin.bankReconciliationReviewOwnerSummary({
      age,
      candidate,
      period,
      q,
      range,
      review,
      source,
      type,
    });
  }

  @Get('bank-reconciliation/withdrawal-candidate-summary')
  bankReconciliationWithdrawalCandidateSummary(@Query('range') range?: string, @Query('q') q?: string) {
    return this.admin.bankReconciliationWithdrawalCandidateSummary({ q, range });
  }

  @Get('bank-reconciliation/import-batches')
  bankReconciliationImportBatches(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('range') range?: string,
    @Query('q') q?: string,
    @Query('review') review?: string,
  ) {
    return this.admin.listCompanyBankTransactionImportBatches({ q, range, review, skip, take });
  }

  @Get('bank-reconciliation/import-batches/summary')
  bankReconciliationImportBatchSummary() {
    return this.admin.companyBankTransactionImportBatchSummary();
  }

  @Get('bank-reconciliation/import-batches/:batchImportId')
  bankReconciliationImportBatchDetail(@Param('batchImportId') batchImportId: string) {
    return this.admin.companyBankTransactionImportBatchDetail(batchImportId);
  }

  @Post('bank-reconciliation/import-batches/:batchImportId/assignment')
  assignBankReconciliationImportBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchImportId') batchImportId: string,
    @Body() body: AssignCompanyBankTransactionImportBatchDto,
  ) {
    return this.admin.assignCompanyBankTransactionImportBatch(user.id, batchImportId, body);
  }

  @Get('bank-reconciliation/:id')
  bankReconciliationTransactionDetail(
    @Param('id') id: string,
    @Query('candidateQ') candidateQ?: string,
    @Query('candidatePage') candidatePage?: string,
    @Query('candidateTake') candidateTake?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return user?.id
      ? this.admin.bankReconciliationTransactionDetail(
          id,
          user.id,
          candidateQ,
          candidatePage,
          candidateTake,
        )
      : this.admin.bankReconciliationTransactionDetail(
          id,
          undefined,
          candidateQ,
          candidatePage,
          candidateTake,
        );
  }

  @Post('bank-reconciliation/review-assignments')
  assignBankReconciliationTransactionReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignCompanyBankTransactionReviewsDto,
  ) {
    return this.admin.assignCompanyBankTransactionReviews(user.id, body);
  }

  @Post('bank-reconciliation/:id/review-assignment')
  assignBankReconciliationTransactionReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignCompanyBankTransactionReviewDto,
  ) {
    return this.admin.assignCompanyBankTransactionReview(user.id, id, body);
  }

  @Post('bank-reconciliation/transactions')
  createCompanyBankTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompanyBankTransactionDto,
  ) {
    return this.admin.createCompanyBankTransaction(user.id, body);
  }

  @Post('bank-reconciliation/transactions/batch-preview')
  previewCompanyBankTransactionBatch(@Body() body: PreviewCompanyBankTransactionBatchDto) {
    return this.admin.previewCompanyBankTransactionBatch(body);
  }

  @Post('bank-reconciliation/transactions/batch-import')
  importCompanyBankTransactionBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportCompanyBankTransactionBatchDto,
  ) {
    return this.admin.importCompanyBankTransactionBatch(user.id, body);
  }

  @Post('bank-reconciliation/:id/matches')
  createBankReconciliationMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateBankReconciliationMatchDto,
  ) {
    return this.admin.createBankReconciliationMatch(user.id, id, body);
  }

  @Post('bank-reconciliation/:id/matches/:matchId/reverse')
  reverseBankReconciliationMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() body: ReverseBankReconciliationMatchDto,
  ) {
    return this.admin.reverseBankReconciliationMatch(user.id, id, matchId, body);
  }

  @Post('bank-reconciliation/:id/ignore')
  ignoreCompanyBankTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: IgnoreCompanyBankTransactionDto,
  ) {
    return this.admin.ignoreCompanyBankTransaction(user.id, id, body);
  }
}
