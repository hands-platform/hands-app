import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..');

describe('API smoke contract', () => {
  it('keeps admin service catalog smoke lightweight after provider service price updates', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("getJson('/admin/services', adminAuth.accessToken)");
    expect(scriptSource).toContain('payoutRules');
    expect(scriptSource).not.toContain('Admin service impact data is missing provider price rows');
    expect(scriptSource).not.toContain('adminServiceAfterProviderPriceUpdate?.providers?.some');
    expect(scriptSource).not.toContain('Admin service finance trace is incomplete');
    expect(scriptSource).not.toContain('serviceFinanceTraceReady');
  });

  it('asserts split cash booking deduction ledger entries in smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('CASH_BOOKING_PLATFORM_FEE_DEDUCTED');
    expect(scriptSource).toContain('CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED');
    expect(scriptSource).toContain('CASH_BOOKING_PARTNER_TAX_DEDUCTED');
    expect(scriptSource).toContain('walletDeductionPlatformFeeNetRevenue');
    expect(scriptSource).toContain('walletDeductionCompanyOutputVat');
    expect(scriptSource).toContain('walletDeductionPartnerTaxPayable');
  });

  it('keeps cash settlement summary smoke independent from capped top provider groups', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('adminCashSettlementSummary.totalDebtAmount < Math.abs(cashSettlementDebtRow.netAmount)');
    expect(scriptSource).toContain('adminCashSettlementSummary.topProviderGroups?.some((group) => group.debtAmount > 0)');
    expect(scriptSource).not.toContain('group.providerProfileId === walletDebtProviderAuth.user.providerProfile.id');
  });

  it('does not require a specific customer inside the unfiltered admin users smoke list', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("getJson('/admin/app-sessions', adminAuth.accessToken)");
    expect(scriptSource).not.toContain("getJson('/admin/users', adminAuth.accessToken)");
    expect(scriptSource).not.toContain('Admin user payload is missing customer app session heartbeat');
  });

  it('uses a separate finance approver for payout batch paid closeout smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('const financeApproverAuth = await createSmokeAdminAuth');
    expect(scriptSource).toContain('approvalAdminId: financeApproverAuth.user.id');
    expect(scriptSource).toContain("status: 'PAID'");
    expect(scriptSource).toContain('transferRef: payoutBatchUpdate.transferRef');
    expect(scriptSource).toContain("entry.type === 'PAYOUT_PAID' && entry.metadata?.payoutBatchId === payoutBatch.id");
  });

  it('uses a separate finance approver for admin payment refund smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("postJson(`/admin/payments/${payment.id}/refund`, adminAuth.accessToken");
    expect(scriptSource).toContain('approvalAdminId: financeApproverAuth.user.id');
  });

  it('asserts finance dual approval and role separation guards in live smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('createSmokeAdminOnlyAuth');
    expect(scriptSource).toContain('const nonFinanceAdminAuth = await createSmokeAdminOnlyAuth');
    expect(scriptSource).toContain('Manual wallet adjustment requires approval from a different admin');
    expect(scriptSource).toContain('Manual wallet adjustment requires approval from a finance approver');
    expect(scriptSource).toContain('Payout batch paid closeout requires approval from a different admin');
    expect(scriptSource).toContain('Payout batch paid closeout requires approval from a finance approver');
    expect(scriptSource).toContain(
      'Partner withholding remittance paid closeout requires approval from a different admin',
    );
    expect(scriptSource).toContain(
      'Partner withholding remittance paid closeout requires approval from a finance approver',
    );
    expect(scriptSource).toContain('financeDualApprovalRoleSeparationReady');
  });

  it('covers live bank reconciliation create, match, and reverse operations', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('ensureSmokeCompanyBankAccount');
    expect(scriptSource).toContain("'/admin/bank-reconciliation/transactions'");
    expect(scriptSource).toContain('confirmPotentialDuplicate: true');
    expect(scriptSource).toContain(
      "operatorReason: 'Reviewed repeatable API smoke bank evidence before import.'",
    );
    expect(scriptSource).toContain('`/admin/bank-reconciliation/${smokeBankTransaction.id}/matches`');
    expect(scriptSource).toContain("paymentClearingEntry?.status !== 'CLEARED'");
    expect(scriptSource).toContain('smokeBankReconciliationMatch.match?.amount !== completedPaymentClearingEntry.amount');
    expect(scriptSource).toContain('smokeBankReconciliationMatch.match?.currency !== completedPaymentClearingCurrency');
    expect(scriptSource).toContain(
      'matches/${smokeBankReconciliationMatch.match.id}/reverse',
    );
    expect(scriptSource).toContain("paymentClearingEntry?.status !== 'OPEN'");
    expect(scriptSource).toContain('bankReconciliationMatchAmount');
    expect(scriptSource).toContain('bankReconciliationMatchCurrency');
    expect(scriptSource).toContain('bankReconciliationTransactionId');
    expect(scriptSource).toContain('bankReconciliationPaymentClearingReopened');
  });

  it('asserts completed booking settlement journal revenue, VAT, and payment fee lines in smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("assertJournalEntry('Completed booking settlement journal', completedSettlementJournal");
    expect(scriptSource).toContain("accountCode: 'platform_fee_net_revenue'");
    expect(scriptSource).toContain("amount: completedSettlementSnapshot.platformFeeNetRevenue");
    expect(scriptSource).toContain("accountCode: 'company_output_vat_payable'");
    expect(scriptSource).toContain("amount: completedSettlementSnapshot.companyOutputVat");
    expect(scriptSource).toContain("accountCode: 'payment_processing_fee_expense'");
    expect(scriptSource).toContain("accountCode: 'payment_processing_fee_clearing'");
    expect(scriptSource).toContain("amount: completedSettlementSnapshot.paymentProcessingFee");
  });

  it('asserts refund reversal and manual wallet adjustment journal evidence in smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("assertBalancedAccountingJournal('Refund settlement reversal journal'");
    expect(scriptSource).toContain("accountCode: 'partner_receivable_negative_wallet'");
    expect(scriptSource).toContain("accountCode: 'booking_payment_clearing'");
    expect(scriptSource).toContain('refundAfterPayoutReceivableLedger');
    expect(scriptSource).toContain("sourceKey === `earning:${completedEarning.id}:paid-refund-receivable`");
    expect(scriptSource).toContain('metadata?.refundAfterPayout !== true');
    expect(scriptSource).toContain('metadata?.payoutBatchId !== payoutBatch.id');
    expect(scriptSource).toContain('refundAfterPayoutReceivableReady');
    expect(scriptSource).toContain("assertBalancedAccountingJournal('Manual wallet adjustment journal'");
    expect(scriptSource).toContain("accountCode: 'customer_compensation_expense'");
    expect(scriptSource).toContain("accountCode: 'customer_wallet_liability'");
  });

  it('asserts monthly close is blocked when posted journal reconciliation deltas remain open', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('assertMonthlyCloseBlocksOpenJournalDelta');
    expect(scriptSource).toContain("const sourceKey = 'api-smoke:monthly-close:blocking-journal-delta'");
    expect(scriptSource).toContain("metadata: { reconciliationDelta: 42000");
    expect(scriptSource).toContain("`/admin/monthly-tax-closings/${period}/status`");
    expect(scriptSource).toContain(
      'Monthly close requires posted journal reconciliation deltas to be cleared before status can advance.',
    );
    expect(scriptSource).toContain('monthlyCloseOpenJournalDeltaBlocked');
  });

  it('asserts partner withholding remittance paid lifecycle in live smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('assertWithholdingRemittanceLifecycle');
    expect(scriptSource).toContain("status: 'PAID'");
    expect(scriptSource).toContain('remittanceTransferRef');
    expect(scriptSource).toContain('remittanceEvidenceUrl');
    expect(scriptSource).toContain("sourceType === 'WITHHOLDING_REMITTANCE'");
    expect(scriptSource).toContain("assertBalancedAccountingJournal('Withholding remittance journal'");
    expect(scriptSource).toContain("accountCode: 'partner_vat_pit_payable'");
    expect(scriptSource).toContain("accountCode: 'company_bank_cash'");
    expect(scriptSource).toContain('withholdingRemittancePaidLifecycleReady');
  });

  it('asserts provider wallet withdrawal paid lifecycle in live smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('ensureSmokeProviderWalletWithdrawalPrerequisites');
    expect(scriptSource).toContain("'/partner/earnings/wallet-withdrawal-requests'");
    expect(scriptSource).toContain("'/admin/provider-wallet/withdrawal-requests'");
    expect(scriptSource).toContain(
      'Provider wallet withdrawal paid closeout requires approval from a different admin',
    );
    expect(scriptSource).toContain(
      'Provider wallet withdrawal paid closeout requires approval from a finance approver',
    );
    expect(scriptSource).toContain('Transfer reference is required before marking a withdrawal request paid');
    expect(scriptSource).toContain('Bank transfer evidence is required before marking a withdrawal request paid');
    expect(scriptSource).toContain('PARTNER_WALLET_WITHDRAWAL_PAID');
    expect(scriptSource).toContain('`partner-wallet-withdrawal:${providerWalletWithdrawalRequest.id}:paid`');
    expect(scriptSource).toContain('providerWalletWithdrawalLedger');
    expect(scriptSource).toContain('providerWalletWithdrawalPaidLifecycleReady');
  });

  it('waits long enough for asynchronous FCM delivery smoke diagnostics', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('let fcmPolicyNotificationCandidate = null');
    expect(scriptSource).toContain('for (let attempt = 0; attempt < 60; attempt++)');
    expect(scriptSource).toContain('/notifications?take=50');
    expect(scriptSource).toContain('marketplaceInvitationLimitBeforeFcmSmoke');
    expect(scriptSource).toContain("'matching.marketplace_partner_invitation_limit', 1");
    expect(scriptSource).toContain('fcmPolicyNotificationCandidate');
  });
});
