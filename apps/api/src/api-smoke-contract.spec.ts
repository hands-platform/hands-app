import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..');

describe('API smoke contract', () => {
  it('keeps admin service catalog smoke lightweight after provider service price updates', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("getJson('/admin/services', adminAuth.accessToken)");
    expect(scriptSource).toContain('payoutRules');
    expect(scriptSource).toContain('const mutableSmokeService = smokeDurationSet[0]');
    expect(scriptSource).toContain('/admin/services/${mutableSmokeService.id}/payout-rules');
    expect(scriptSource).not.toContain('/admin/services/${service.id}/payout-rules');
    expect(scriptSource).toContain('{ published = false, publicCatalog = false } = {}');
    expect(scriptSource).toContain('publicCatalog: true');
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

  it('declares the expected byte size for every presigned smoke upload', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');
    const presignCount = scriptSource.match(/postJson\('\/files\/presign'/g)?.length ?? 0;
    const sizeCount = scriptSource.match(/sizeBytes: (?:1024|2048|4096|8192)/g)?.length ?? 0;

    expect(presignCount).toBe(7);
    expect(sizeCount).toBe(presignCount);
  });

  it('creates a checkout-ready coupon with bounded VND exposure', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('maxRedemptions: 10');
    expect(scriptSource).toContain('grossBudgetAmount: 1000000');
    expect(scriptSource).toContain('perCustomerRedemptionLimit: 2');
    expect(scriptSource).toContain('maximumDiscountAmount: 100000');
    expect(scriptSource).toContain("currency: 'VND'");
  });

  it('preserves the matching deadline guard before exercising manual expiry', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('function moveTrackedBookingMatchingDeadlineToPast(bookingId)');
    expect(scriptSource).toContain('apiSmokeBookingTracker.has(bookingId)');
    expect(scriptSource).toContain('status: BookingStatus.OPEN_MATCHING');
    expect(scriptSource).toContain('createdAt: { gte: apiSmokeStartedAt }');
    expect(scriptSource).toContain('Admin manual expiry rejects a booking before its matching deadline');
    expect(scriptSource).toContain('Booking matching deadline has not passed');
    expect(scriptSource).toContain(
      'await moveTrackedBookingMatchingDeadlineToPast(manuallyExpiredBooking.id)',
    );
  });

  it('uses deterministic run-scoped idempotency for admin payment commands', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('function apiSmokePaymentActionBody(action, paymentId)');
    expect(scriptSource).toContain('idempotencyKey: `api-smoke:${action}:${apiSmokeRunId}:${paymentId}`');
    expect(scriptSource).toContain("apiSmokePaymentActionBody('cancelled-sync'");
    expect(scriptSource).toContain("'Released payment rejects gateway sync'");
    expect(scriptSource).toContain('PAYMENT_STATE_NOT_SYNCABLE');
    expect(scriptSource).toContain('cancelledPaymentSyncBlocked: true');
    expect(scriptSource).toContain("apiSmokePaymentActionBody('momo-release'");
    expect(scriptSource).toContain('BOOKING_STATE_NOT_RELEASEABLE');
    expect(scriptSource).toContain('momoReleaseBlocked');
    expect(scriptSource).toContain("apiSmokePaymentActionBody('cash-capture'");
    expect(scriptSource).toContain('BOOKING_NOT_COMPLETED');
    expect(scriptSource).toContain('cashCaptureBlocked');
  });

  it('checks public partner location buckets without requiring precise location evidence', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("nearbyProvider?.locationFreshness !== 'FRESH'");
    expect(scriptSource).toContain("globalBrowseProvider.distanceBucket !== 'OVER_20_KM'");
    expect(scriptSource).toContain("'currentLocationUpdatedAt' in nearbyProvider");
    expect(scriptSource).toContain("'distanceMeters' in globalBrowseProvider");
    expect(scriptSource).not.toContain('nearbyProviderDistanceMeters:');
    expect(scriptSource).not.toContain('globalBrowsePartnerDistanceMeters:');
  });

  it('checks negative-wallet settlement guidance without claiming marketplace participation is blocked', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('Bạn vẫn có thể xem và tham gia yêu cầu đặt lịch');
    expect(scriptSource).toContain('Quyền xác nhận nhận lịch, bắt đầu dịch vụ và nhận tiền chi trả');
    expect(scriptSource).not.toContain('Quyền tham gia đặt lịch và nhận tiền chi trả');
  });

  it('expects chat repair to reject an open-matching booking at the lifecycle gate', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('Booking status OPEN_MATCHING cannot repair a chat room');
    expect(scriptSource).not.toContain(
      "preMatchChatRepairError.includes('Final partner selection is required before repairing chat room')",
    );
  });

  it('checks the message-row shape of the admin chat archive', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('item.id === chatMessage.id');
    expect(scriptSource).toContain('item.chatRoom?.booking?.id === booking.id');
    expect(scriptSource).not.toContain('item.chatRoom?.messages?.some');
  });

  it('keeps cash settlement summary smoke independent from capped top provider groups', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain(
      'adminCashSettlementSummary.totalDebtAmount < Math.abs(cashSettlementDebtRow.netAmount)',
    );
    expect(scriptSource).not.toContain('adminCashSettlementSummary.topProviderGroups?.some');
    expect(scriptSource).not.toContain(
      'group.providerProfileId === walletDebtProviderAuth.user.providerProfile.id',
    );
  });

  it('does not require a specific customer inside the unfiltered admin users smoke list', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("getJson('/admin/app-sessions', adminAuth.accessToken)");
    expect(scriptSource).not.toContain("getJson('/admin/users', adminAuth.accessToken)");
    expect(scriptSource).not.toContain('Admin user payload is missing customer app session heartbeat');
  });

  it('provides an auditable operator reason for notification retry', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('API smoke retries a reviewed notification delivery.');
    expect(scriptSource).toContain("retryDecision?.state === 'allowed'");
    expect(scriptSource).toContain('Notification retry blocked by failure policy');
    expect(scriptSource).toContain('retryPolicyBlocked');
  });

  it('uses a separate finance approver for payout batch paid closeout smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('const financeApproverAuth = await createSmokeAdminAuth');
    expect(scriptSource).toContain('financeApproverAuth.accessToken,');
    expect(scriptSource).toContain('payoutBatchWithholdingAmount');
    expect(scriptSource).toContain('payoutBatchWithholdingAmount === 0');
    expect(scriptSource).toContain("status: 'PROCESSING'");
    expect(scriptSource).toContain("status: 'PAID'");
    expect(scriptSource).toContain('Payout batch paid closeout rejects same-admin approval');
    expect(scriptSource).toContain(
      "entry.type === 'PAYOUT_PAID' && entry.metadata?.payoutBatchId === payoutBatch.id",
    );
  });

  it('uses a separate finance approver for admin payment refund smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain(
      'postJson(`/admin/payments/${payment.id}/refund-request`, adminAuth.accessToken',
    );
    expect(scriptSource).toContain(
      'postJson(`/admin/payments/${payment.id}/refund`, financeApproverAuth.accessToken, {})',
    );
  });

  it('keeps tax policy smoke writes isolated as drafts', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('const taxPolicyVersions = taxPolicyVersionPage?.items');
    expect(scriptSource).toContain("typeof taxPolicyVersionPage.total !== 'number'");
    expect(scriptSource).toContain('const taxPolicyDraftEvidence = {');
    expect(scriptSource).toContain(
      "operatorReason: 'API smoke verified isolated tax policy draft evidence.'",
    );
    expect(scriptSource).toContain("postJson('/admin/tax-policy-versions', adminAuth.accessToken, {");
    expect(scriptSource).toContain("'Direct ACTIVE tax policy creation is rejected'");
    expect(scriptSource).not.toContain('approvalAdminId: financeApproverAuth.user.id');
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
    expect(scriptSource).toMatch(
      /'Withholding remittance paid closeout rejects non-finance approver',[\s\S]{0,600}?\n\s+403,/,
    );
    expect(scriptSource).toMatch(
      /'Manual wallet adjustment rejects non-finance approver',[\s\S]{0,500}?\n\s+403,/,
    );
    expect(scriptSource).toMatch(
      /'Payout batch paid closeout rejects non-finance approver',[\s\S]{0,400}?\n\s+403,/,
    );
    expect(scriptSource).toContain('financeDualApprovalRoleSeparationReady');
  });

  it('covers live bank reconciliation create, match, and reverse operations', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('ensureSmokeCompanyBankAccount');
    expect(scriptSource).toContain('API_SMOKE_VERIFIED_BANK_ACCOUNT_ID');
    expect(scriptSource).toContain('COMPANY_BANK_ACCOUNT_DATA_SCOPE_BLOCKED');
    expect(scriptSource).toContain('bankReconciliationOwnerEvidenceRequired');
    expect(scriptSource).toContain("'/admin/bank-reconciliation/transactions'");
    expect(scriptSource).toContain('confirmPotentialDuplicate: true');
    expect(scriptSource).toContain(
      "operatorReason: 'Reviewed repeatable API smoke bank evidence before import.'",
    );
    const createStart = scriptSource.indexOf('const smokeBankTransaction =');
    const assignmentStart = scriptSource.indexOf('const smokeBankReconciliationAssignment =', createStart);
    const bankImportSource = scriptSource.slice(createStart, assignmentStart);
    expect(createStart).toBeGreaterThan(-1);
    expect(assignmentStart).toBeGreaterThan(createStart);
    expect(bankImportSource).not.toContain('approvalAdminId');
    expect(scriptSource).toContain(
      '`/admin/bank-reconciliation/${smokeBankTransaction.id}/review-assignment`',
    );
    expect(scriptSource).toContain('assigneeAdminId: adminAuth.user.id');
    expect(scriptSource).toContain('`/admin/bank-reconciliation/${smokeBankTransaction.id}/matches`');
    expect(scriptSource).toMatch(
      /`\/admin\/bank-reconciliation\/\$\{smokeBankTransaction\.id\}\/matches`,\s+financeApproverAuth\.accessToken/,
    );
    const matchStart = scriptSource.indexOf('const smokeBankReconciliationMatch =');
    const reverseStart = scriptSource.indexOf('const smokeBankReconciliationReverse =');
    const reconciliationActionSource = scriptSource.slice(matchStart, reverseStart + 700);
    expect(matchStart).toBeGreaterThan(-1);
    expect(reverseStart).toBeGreaterThan(matchStart);
    expect(reconciliationActionSource).not.toContain('approvalAdminId');
    expect(scriptSource).toContain("paymentClearingEntry?.status !== 'CLEARED'");
    expect(scriptSource).toContain(
      'smokeBankReconciliationMatch.match?.amount !== completedPaymentClearingEntry.amount',
    );
    expect(scriptSource).toContain(
      'smokeBankReconciliationMatch.match?.currency !== completedPaymentClearingCurrency',
    );
    expect(scriptSource).toContain('matches/${smokeBankReconciliationMatch.match.id}/reverse');
    expect(scriptSource).toContain("paymentClearingEntry?.status !== 'OPEN'");
    expect(scriptSource).toContain('bankReconciliationMatchAmount');
    expect(scriptSource).toContain('bankReconciliationMatchCurrency');
    expect(scriptSource).toContain('bankReconciliationTransactionId');
    expect(scriptSource).toContain('bankReconciliationPaymentClearingReopened');
    expect(scriptSource).toContain("'/admin/bank-reconciliation/transactions/batch-preview'");
    expect(scriptSource).toContain("'/admin/bank-reconciliation/transactions/batch-import'");
    expect(scriptSource).toContain('smokeBankBatchDetail.creationEvidence?.importedByAdminId');
    expect(scriptSource).toContain('smokeBankBatchDetail.creationEvidence?.approvalAdminId');
    expect(scriptSource).toContain('smokeBankBatchIgnore.bankTransaction?.status !==');
    const batchImportStart = scriptSource.indexOf('const smokeBankBatchImport =');
    const batchAssignmentStart = scriptSource.indexOf(
      '`/admin/bank-reconciliation/${smokeBankBatchTransactionId}/review-assignment`',
      batchImportStart,
    );
    const batchImportSource = scriptSource.slice(batchImportStart, batchAssignmentStart);
    expect(batchImportStart).toBeGreaterThan(-1);
    expect(batchAssignmentStart).toBeGreaterThan(batchImportStart);
    expect(batchImportSource).not.toContain('approvalAdminId:');
  });

  it('covers staged company bank account approvals and blocks synthetic activation', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    const lifecycleStart = scriptSource.indexOf('const companyBankAccountLifecycleSeed =');
    const reconciliationStart = scriptSource.indexOf(
      'const smokeCompanyBankAccount = await ensureSmokeCompanyBankAccount();',
      lifecycleStart,
    );
    const lifecycleSource = scriptSource.slice(lifecycleStart, reconciliationStart);

    expect(lifecycleStart).toBeGreaterThan(-1);
    expect(reconciliationStart).toBeGreaterThan(lifecycleStart);
    expect(lifecycleSource).toContain("'/admin/company-bank-accounts'");
    expect(lifecycleSource).toContain("bankCode: 'VCB'");
    expect(lifecycleSource).toContain("bankName: 'Vietcombank'");
    expect(lifecycleSource).toContain('/approval-decision');
    expect(lifecycleSource).toContain("decision: 'APPROVE'");
    expect(lifecycleSource).toContain('requires a different Finance approver');
    expect(lifecycleSource).toContain('COMPANY_BANK_ACCOUNT_ACTIVATION_NOT_READY');
    expect(lifecycleSource).toContain("companyBankAccountCreated.status !== 'INACTIVE'");
    expect(lifecycleSource).not.toContain('approvalAdminId');
    expect(scriptSource).not.toContain('prisma.adminAuditLog.deleteMany');
    expect(scriptSource).toContain('companyBankAccountStagedApprovalReady');
  });

  it('asserts completed booking settlement journal revenue, VAT, and payment fee lines in smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain(
      "assertJournalEntry('Completed booking settlement journal', completedSettlementJournal",
    );
    expect(scriptSource).toContain("accountCode: 'platform_fee_net_revenue'");
    expect(scriptSource).toContain('amount: completedSettlementSnapshot.platformFeeNetRevenue');
    expect(scriptSource).toContain("accountCode: 'company_output_vat_payable'");
    expect(scriptSource).toContain('amount: completedSettlementSnapshot.companyOutputVat');
    expect(scriptSource).toContain("accountCode: 'payment_processing_fee_expense'");
    expect(scriptSource).toContain("accountCode: 'payment_processing_fee_clearing'");
    expect(scriptSource).toContain('amount: completedSettlementSnapshot.paymentProcessingFee');
  });

  it('asserts refund reversal and manual wallet adjustment journal evidence in smoke', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("assertBalancedAccountingJournal('Refund settlement reversal journal'");
    expect(scriptSource).toContain("accountCode: 'partner_receivable_negative_wallet'");
    expect(scriptSource).toContain("accountCode: 'booking_payment_clearing'");
    expect(scriptSource).toContain('refundAfterPayoutReceivableLedger');
    expect(scriptSource).toContain('sourceKey === `earning:${completedEarning.id}:paid-refund-receivable`');
    expect(scriptSource).toContain('metadata?.refundAfterPayout !== true');
    expect(scriptSource).toContain('metadata?.payoutBatchId !== payoutBatch.id');
    expect(scriptSource).toContain('refundAfterPayoutReceivableReady');
    expect(scriptSource).toContain("assertBalancedAccountingJournal('Manual wallet adjustment journal'");
    expect(scriptSource).toContain("accountCode: 'customer_compensation_expense'");
    expect(scriptSource).toContain("accountCode: 'customer_wallet_liability'");
    expect(scriptSource).toContain('function ensureApiSmokeOpenMonthlyPeriod');
    expect(scriptSource).toContain("!['DRAFT', 'REVIEWED'].includes(existing.status)");
    expect(scriptSource).toContain('monthlyPeriod: completedSettlementSnapshot.monthlyPeriod');
  });

  it('keeps missing tax authority visible instead of inventing positive withholding', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("['NO_ACTIVE_POLICY', 'NO_APPROVED_TAX_PROFILE']");
    expect(scriptSource).toContain('expectedProviderWithholding');
    expect(scriptSource).toContain(
      'Zero withholding must not create a partner VAT/PIT payable journal entry.',
    );
    expect(scriptSource).not.toContain('completedEarning.withholdingAmount <= 0');
    expect(scriptSource).not.toContain('providerEarningsSummary.withholdingAmount <= 0');
  });

  it('asserts monthly close is blocked when a posted journal fails integrity checks', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/api-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('assertMonthlyCloseBlocksInvalidPostedJournal');
    expect(scriptSource).toContain('invalid-posted-journal:${apiSmokeRunId}');
    expect(scriptSource).toContain('metadata: { reconciliationDelta: 42000');
    expect(scriptSource).toContain('`/admin/monthly-tax-closings/${period}/status`');
    expect(scriptSource).toContain(
      'Monthly close requires every posted journal batch to pass header, entry, formula, and period integrity checks before status can advance.',
    );
    expect(scriptSource).toContain('monthlyCloseInvalidPostedJournalBlocked');
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
    expect(scriptSource).toContain('idempotencyKey: `api-smoke-withdrawal-${apiSmokeRunId}`');
    expect(scriptSource).toContain("'/admin/provider-wallet/withdrawal-requests'");
    expect(scriptSource).toContain(
      'Provider wallet withdrawal paid closeout requires approval from a different admin',
    );
    expect(scriptSource).toContain(
      'Provider wallet withdrawal paid closeout requires approval from a finance approver',
    );
    expect(scriptSource).toContain(
      'Provider wallet withdrawal bank transfer request requires a transfer reference',
    );
    expect(scriptSource).toContain(
      'Provider wallet withdrawal bank transfer request requires attached bank evidence',
    );
    expect(scriptSource).toContain(
      'providerWalletWithdrawalPaid.metadata?.bankPayout?.preparedByAdminId !== adminAuth.user.id',
    );
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
    expect(scriptSource).toMatch(/'matching\.marketplace_partner_invitation_limit',\s+1/);
    expect(scriptSource).toContain('fcmPolicyNotificationCandidate');
  });

  it('reuses stable Supabase auth smoke subjects instead of accumulating analytics users', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/supabase-auth-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain("customer: 'smoke-supabase-auth-customer'");
    expect(scriptSource).toContain("provider: 'smoke-supabase-auth-provider'");
    expect(scriptSource).toContain("escalation: 'smoke-supabase-auth-role-escalation'");
    expect(scriptSource).toContain("userMetadataEscalation: 'smoke-supabase-auth-user-metadata-escalation'");
    expect(scriptSource).not.toContain('randomUUID');
  });
});
