import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
  MonthlyTaxClosingStatus,
  PayoutBatchStatus,
  ProviderReportSeverity,
  ReferralRewardMode,
} from '@prisma/client';
import { AdminController } from './admin.controller';
import {
  AdminPushCampaignConfirmDto,
  AdminPushCampaignDto,
  AllocateCashSettlementDebtDto,
} from './admin.dto';

describe('admin request DTO validation', () => {
  function bodyMetatype(methodName: keyof AdminController, bodyIndex: number) {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      AdminController.prototype,
      methodName,
    ) as unknown[];
    return paramTypes?.[bodyIndex] as object | undefined;
  }

  it('requires explicit role, locale, destination, and copy for manual Push preview', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const valid = {
      appDestination: 'notificationCenter',
      body: '  A reviewed manual Push message.  ',
      locale: 'vi',
      targetRole: 'PROVIDER',
      targetSegment: 'all',
      title: '  HANDS update  ',
    };

    await expect(
      pipe.transform(valid, { type: 'body', metatype: AdminPushCampaignDto, data: '' }),
    ).resolves.toMatchObject({ body: 'A reviewed manual Push message.', title: 'HANDS update' });
    await expect(
      pipe.transform(
        { ...valid, locale: undefined },
        { type: 'body', metatype: AdminPushCampaignDto, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('rejects the legacy send body and validates the preview confirmation receipt', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const confirmation = {
      confirmationPhrase: '  SEND 12  ',
      idempotencyKey: 'push-confirm-request-12',
      previewId: 'preview-12',
      reason: '  Send the reviewed service notice to this audience.  ',
    };

    await expect(
      pipe.transform(confirmation, {
        type: 'body',
        metatype: AdminPushCampaignConfirmDto,
        data: '',
      }),
    ).resolves.toEqual({
      confirmationPhrase: 'SEND 12',
      idempotencyKey: 'push-confirm-request-12',
      previewId: 'preview-12',
      reason: 'Send the reviewed service notice to this audience.',
    });
    await expect(
      pipe.transform(
        {
          appDestination: 'notificationCenter',
          body: 'Legacy immediate send payload',
          locale: 'en',
          targetRole: 'CUSTOMER',
          targetSegment: 'all',
          title: 'Legacy send',
        },
        { type: 'body', metatype: AdminPushCampaignConfirmDto, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses a concrete DTO for operational policy updates', () => {
    expect((bodyMetatype('updateOperationalPolicy', 2) as { name?: string })?.name).toBe(
      'UpdateOperationalPolicyDto',
    );
  });

  it('requires a controlled reason code for cash settlement allocations', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = await pipe.transform(
      {
        amount: 120000,
        notes: ' Allocate approved deposit evidence ',
        reasonCode: 'FINAL_RECOVERY',
        requestId: ' deposit-request-22 ',
      },
      { type: 'body', metatype: AllocateCashSettlementDebtDto, data: '' },
    );

    expect(transformed).toEqual({
      amount: 120000,
      notes: 'Allocate approved deposit evidence',
      reasonCode: 'FINAL_RECOVERY',
      requestId: 'deposit-request-22',
    });
    await expect(
      pipe.transform(
        {
          amount: 120000,
          notes: 'Allocate approved deposit evidence',
          requestId: 'deposit-request-22',
        },
        { type: 'body', metatype: AllocateCashSettlementDebtDto, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          amount: 120000,
          notes: 'Allocate approved deposit evidence',
          reasonCode: 'UNREVIEWED',
          requestId: 'deposit-request-22',
        },
        { type: 'body', metatype: AllocateCashSettlementDebtDto, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses a concrete DTO for referral policy updates', () => {
    expect((bodyMetatype('updateReferralPolicy', 2) as { name?: string })?.name).toBe(
      'UpdateReferralPolicyDto',
    );
  });

  it('uses a concrete DTO for manual marketing spend upserts', () => {
    expect((bodyMetatype('upsertMarketingSpendDaily', 1) as { name?: string })?.name).toBe(
      'UpsertMarketingSpendDailyDto',
    );
  });

  it('uses concrete DTOs for referral reward state changes', () => {
    expect((bodyMetatype('holdReferralReward', 2) as { name?: string })?.name).toBe(
      'ReferralRewardDecisionDto',
    );
    expect((bodyMetatype('creditReferralReward', 2) as { name?: string })?.name).toBe(
      'ReferralRewardDecisionDto',
    );
    expect((bodyMetatype('reverseReferralReward', 2) as { name?: string })?.name).toBe(
      'ReferralRewardDecisionDto',
    );
    expect((bodyMetatype('markReferralRewardCashoutPaid', 2) as { name?: string })?.name).toBe(
      'ReferralRewardCashoutPaidDto',
    );
  });

  it('uses a validated DTO for booking settlement repairs', async () => {
    const metatype = bodyMetatype('repairBookingSettlementGap', 2) as never;
    expect((metatype as { name?: string })?.name).toBe('RepairBookingSettlementGapDto');

    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        reason: ' restore missing completion settlement ',
        sourceVersion: ' booking:v1|payment:v1|policy:v1 ',
        bypassMonthlyClose: true,
      },
      { type: 'body', metatype, data: '' },
    );

    expect(transformed).toEqual({
      approvalAdminId: 'finance-admin-2',
      reason: 'restore missing completion settlement',
      sourceVersion: 'booking:v1|payment:v1|policy:v1',
    });
    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          reason: 'too short',
          sourceVersion: 'booking:v1',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          reason: 'restore missing completion settlement',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('strips unsupported operational policy fields while preserving value', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        expectedValue: 8,
        value: 10,
        reason: '  first-pick policy update  ',
        dangerouslySetBy: 'mobile-client',
      },
      { type: 'body', metatype: bodyMetatype('updateOperationalPolicy', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('expectedValue', 8);
    expect(transformed).toHaveProperty('value', 10);
    expect(transformed).toHaveProperty('reason', 'first-pick policy update');
    expect(transformed).not.toHaveProperty('dangerouslySetBy');

    await expect(
      pipe.transform(
        { value: 10, reason: 'first-pick policy update' },
        { type: 'body', metatype: bodyMetatype('updateOperationalPolicy', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes referral policy numeric fields and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        enabled: true,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        commissionPercentBps: '750',
        maxRewardedReferrals: '5',
        currency: ' vnd ',
        expectedUpdatedAt: null,
        reason: '  referral policy setup  ',
        payoutImmediately: true,
      },
      { type: 'body', metatype: bodyMetatype('updateReferralPolicy', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('commissionPercentBps', 750);
    expect(transformed).toHaveProperty('maxRewardedReferrals', 5);
    expect(transformed).toHaveProperty('currency', 'vnd');
    expect(transformed).toHaveProperty('expectedUpdatedAt', null);
    expect(transformed).toHaveProperty('reason', 'referral policy setup');
    expect(transformed).not.toHaveProperty('payoutImmediately');
  });

  it('normalizes manual marketing spend fields and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        spendDate: ' 2026-06-20 ',
        source: ' Google Ads ',
        platform: ' ANDROID ',
        regionCode: ' hcm ',
        campaignId: ' launch-hcm ',
        campaignName: ' Launch HCMC ',
        spendAmount: '600000',
        currency: ' vnd ',
        expectedUpdatedAt: '2026-06-21T02:00:00.000Z',
        notes: ' manual import ',
        reason: ' correct Google invoice total ',
        adNetworkToken: 'do-not-store',
      },
      { type: 'body', metatype: bodyMetatype('upsertMarketingSpendDaily', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('spendDate', '2026-06-20');
    expect(transformed).toHaveProperty('source', 'Google Ads');
    expect(transformed).toHaveProperty('spendAmount', 600000);
    expect(transformed).toHaveProperty('currency', 'vnd');
    expect(transformed).toHaveProperty('expectedUpdatedAt', '2026-06-21T02:00:00.000Z');
    expect(transformed).toHaveProperty('reason', 'correct Google invoice total');
    expect(transformed).not.toHaveProperty('adNetworkToken');

    await expect(
      pipe.transform(
        {
          expectedUpdatedAt: null,
          source: 'google',
          spendAmount: 600000,
          spendDate: '2026-06-20',
          reason: 'short',
        },
        { type: 'body', metatype: bodyMetatype('upsertMarketingSpendDaily', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes referral reward decision reasons and strips payout fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        expectedStatus: 'PENDING',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: '  suspicious referral activity  ',
        walletCreditCreated: true,
      },
      { type: 'body', metatype: bodyMetatype('holdReferralReward', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('reason', 'suspicious referral activity');
    expect(transformed).toHaveProperty('expectedStatus', 'PENDING');
    expect(transformed).toHaveProperty('expectedUpdatedAt', '2026-08-10T10:00:00.000Z');
    expect(transformed).not.toHaveProperty('walletCreditCreated');

    await expect(
      pipe.transform(
        {
          expectedStatus: 'PENDING',
          expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
          reason: 'too short',
        },
        { type: 'body', metatype: bodyMetatype('holdReferralReward', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { reason: 'Evidence reviewed and decision confirmed.' },
        { type: 'body', metatype: bodyMetatype('holdReferralReward', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes referral reward cashout paid transfer evidence', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        expectedStatus: 'CASHOUT_APPROVED',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: '  bank transfer completed  ',
        transferRef: ' VCB-REF-001 ',
        walletCreditCreated: true,
      },
      { type: 'body', metatype: bodyMetatype('markReferralRewardCashoutPaid', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('approvalAdminId', 'finance-admin-2');
    expect(transformed).toHaveProperty('reason', 'bank transfer completed');
    expect(transformed).toHaveProperty('transferRef', 'VCB-REF-001');
    expect(transformed).not.toHaveProperty('walletCreditCreated');
  });

  it('uses concrete DTOs for payout administration payloads', () => {
    expect((bodyMetatype('markEarningPaid', 2) as { name?: string })?.name).toBe('MarkEarningPaidDto');
    expect((bodyMetatype('recordPartnerBankDeposit', 1) as { name?: string })?.name).toBe(
      'RecordPartnerBankDepositDto',
    );
    expect((bodyMetatype('createPartnerBankDepositRequest', 1) as { name?: string })?.name).toBe(
      'CreatePartnerBankDepositRequestDto',
    );
    expect((bodyMetatype('rejectPartnerBankDepositRequest', 2) as { name?: string })?.name).toBe(
      'RejectPartnerBankDepositRequestDto',
    );
    expect((bodyMetatype('allocatePartnerBankDepositCashDebt', 2) as { name?: string })?.name).toBe(
      'AllocatePartnerBankDepositCashDebtDto',
    );
    expect((bodyMetatype('updateMonthlyTaxClosingStatus', 2) as { name?: string })?.name).toBe(
      'UpdateMonthlyTaxClosingStatusDto',
    );
    expect((bodyMetatype('createPayoutBatch', 1) as { name?: string })?.name).toBe('CreatePayoutBatchDto');
    expect((bodyMetatype('updatePayoutBatch', 2) as { name?: string })?.name).toBe('UpdatePayoutBatchDto');
    expect(
      (bodyMetatype('createBankReconciliationMatch' as keyof AdminController, 2) as { name?: string })?.name,
    ).toBe('CreateBankReconciliationMatchDto');
    expect(
      (bodyMetatype('reverseBankReconciliationMatch' as keyof AdminController, 3) as { name?: string })?.name,
    ).toBe('ReverseBankReconciliationMatchDto');
    expect(
      (bodyMetatype('ignoreCompanyBankTransaction' as keyof AdminController, 2) as { name?: string })?.name,
    ).toBe('IgnoreCompanyBankTransactionDto');
    expect(
      (bodyMetatype('createCompanyBankAccount' as keyof AdminController, 1) as { name?: string })?.name,
    ).toBe('CreateCompanyBankAccountDto');
    expect(
      (bodyMetatype('updateCompanyBankAccount' as keyof AdminController, 2) as { name?: string })?.name,
    ).toBe('UpdateCompanyBankAccountDto');
    expect(
      (bodyMetatype('createCompanyBankTransaction' as keyof AdminController, 1) as { name?: string })?.name,
    ).toBe('CreateCompanyBankTransactionDto');
    expect(
      (bodyMetatype('previewCompanyBankTransactionBatch' as keyof AdminController, 0) as { name?: string })
        ?.name,
    ).toBe('PreviewCompanyBankTransactionBatchDto');
    expect(
      (bodyMetatype('importCompanyBankTransactionBatch' as keyof AdminController, 1) as { name?: string })
        ?.name,
    ).toBe('ImportCompanyBankTransactionBatchDto');
    expect(
      (bodyMetatype('assignBankReconciliationImportBatch' as keyof AdminController, 2) as { name?: string })
        ?.name,
    ).toBe('AssignCompanyBankTransactionImportBatchDto');
    expect(
      (
        bodyMetatype('assignBankReconciliationTransactionReviews' as keyof AdminController, 1) as {
          name?: string;
        }
      )?.name,
    ).toBe('AssignCompanyBankTransactionReviewsDto');
    expect(
      (bodyMetatype('assignBookingPaymentClearingReviews' as keyof AdminController, 1) as { name?: string })
        ?.name,
    ).toBe('AssignBookingPaymentClearingReviewsDto');
    expect(
      (
        bodyMetatype('assignPartnerBankDepositReconciliationReviews' as keyof AdminController, 1) as {
          name?: string;
        }
      )?.name,
    ).toBe('AssignPartnerBankDepositReconciliationReviewsDto');
  });

  it('keeps bank statement import approval server-controlled and requires operator evidence', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const manualMetatype = bodyMetatype('createCompanyBankTransaction' as keyof AdminController, 1) as never;
    const batchMetatype = bodyMetatype(
      'importCompanyBankTransactionBatch' as keyof AdminController,
      1,
    ) as never;

    const manual = await pipe.transform(
      {
        amount: '900000',
        approvalAdminId: ' browser-selected-approver ',
        bankAccountId: ' bank-account-1 ',
        occurredAt: '2026-06-30T05:00:00.000Z',
        operatorReason: ' Reviewed original VCB statement evidence ',
        type: CompanyBankTransactionType.INFLOW,
      },
      { type: 'body', metatype: manualMetatype, data: '' },
    );
    expect(manual).toEqual({
      amount: 900000,
      bankAccountId: 'bank-account-1',
      occurredAt: '2026-06-30T05:00:00.000Z',
      operatorReason: 'Reviewed original VCB statement evidence',
      type: CompanyBankTransactionType.INFLOW,
    });

    const batch = await pipe.transform(
      {
        approvalAdminId: ' browser-selected-approver ',
        mappingPreset: 'VCB',
        operatorReason: ' Reviewed statement rows before import ',
        rows: [
          {
            amount: '900000',
            bankAccountId: 'bank-account-1',
            occurredAt: '2026-06-30T05:00:00.000Z',
            rowNumber: 1,
            type: 'INFLOW',
          },
        ],
        sourceFileName: 'VCB-June.csv',
        sourceFileSha256: 'a'.repeat(64),
      },
      { type: 'body', metatype: batchMetatype, data: '' },
    );
    expect(batch).not.toHaveProperty('approvalAdminId');
    expect(batch).toHaveProperty('operatorReason', 'Reviewed statement rows before import');

    await expect(
      pipe.transform(
        {
          amount: 900000,
          bankAccountId: 'bank-account-1',
          occurredAt: '2026-06-30T05:00:00.000Z',
          operatorReason: 'too short',
          type: CompanyBankTransactionType.INFLOW,
        },
        { type: 'body', metatype: manualMetatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates bounded unique bank transaction review assignments', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype(
      'assignBankReconciliationTransactionReviews' as keyof AdminController,
      1,
    ) as never;
    const transformed = await pipe.transform(
      {
        assigneeAdminId: ' finance-operator-1 ',
        bankTransactionIds: [' bank-tx-1 ', 'bank-tx-2'],
        reason: ' Assign the oldest unresolved evidence ',
      },
      { type: 'body', metatype, data: '' },
    );

    expect(transformed).toEqual({
      assigneeAdminId: 'finance-operator-1',
      bankTransactionIds: ['bank-tx-1', 'bank-tx-2'],
      reason: 'Assign the oldest unresolved evidence',
    });
    await expect(
      pipe.transform(
        {
          assigneeAdminId: 'finance-operator-1',
          bankTransactionIds: ['bank-tx-1', 'bank-tx-1'],
          reason: 'Assign the oldest unresolved evidence',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          assigneeAdminId: 'finance-operator-1',
          bankTransactionIds: Array.from({ length: 51 }, (_, index) => `bank-tx-${index}`),
          reason: 'Assign the oldest unresolved evidence',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it.each([
    {
      controllerMethod: 'assignBookingPaymentClearingReviews',
      idsKey: 'clearingEntryIds',
      ids: [' clearing-1 ', 'clearing-2'],
    },
    {
      controllerMethod: 'assignPartnerBankDepositReconciliationReviews',
      idsKey: 'partnerBankDepositRequestIds',
      ids: [' deposit-1 ', 'deposit-2'],
    },
  ])('validates bounded unique ids for $controllerMethod', async ({ controllerMethod, idsKey, ids }) => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype(controllerMethod as keyof AdminController, 1) as never;
    const transformed = await pipe.transform(
      {
        assigneeAdminId: ' finance-operator-1 ',
        [idsKey]: ids,
        reason: ' Assign the oldest unresolved evidence ',
      },
      { type: 'body', metatype, data: '' },
    );

    expect(transformed).toEqual({
      assigneeAdminId: 'finance-operator-1',
      [idsKey]: ids.map((id) => id.trim()),
      reason: 'Assign the oldest unresolved evidence',
    });
    await expect(
      pipe.transform(
        {
          assigneeAdminId: 'finance-operator-1',
          [idsKey]: ['duplicate-id', 'duplicate-id'],
          reason: 'Assign the oldest unresolved evidence',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          assigneeAdminId: 'finance-operator-1',
          [idsKey]: Array.from({ length: 51 }, (_, index) => `target-${index}`),
          reason: 'Assign the oldest unresolved evidence',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates masked company bank account writes and finance evidence', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const createMetatype = bodyMetatype('createCompanyBankAccount', 1) as never;
    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        operatorReason: ' Reviewed treasury account evidence ',
        idempotencyKey: 'company-bank-create-1',
        name: ' Operations VND ',
        bankCode: ' VCB ',
        bankName: ' VCB ',
        accountNumberLast4: '1234',
        currency: ' vnd ',
        rawAccountNumber: 'do-not-accept',
      },
      { type: 'body', metatype: createMetatype, data: '' },
    );

    expect(transformed).toMatchObject({
      operatorReason: 'Reviewed treasury account evidence',
      name: 'Operations VND',
      bankCode: 'VCB',
      bankName: 'VCB',
      accountNumberLast4: '1234',
      currency: 'vnd',
    });
    expect(transformed).not.toHaveProperty('approvalAdminId');
    expect(transformed).not.toHaveProperty('rawAccountNumber');
    await expect(
      pipe.transform(
        {
          operatorReason: 'short',
          idempotencyKey: 'company-bank-create-2',
          name: 'Operations VND',
          bankName: 'VCB',
          accountNumberLast4: '12',
          currency: 'VND',
        },
        { type: 'body', metatype: createMetatype, data: '' },
      ),
    ).rejects.toThrow();

    const updateMetatype = bodyMetatype('updateCompanyBankAccount', 2) as never;
    const update = await pipe.transform(
      {
        approvalAdminId: 'browser-supplied-admin',
        idempotencyKey: 'company-bank-update-1',
        operatorReason: 'Archive after treasury review',
        status: CompanyBankAccountStatus.INACTIVE,
      },
      { type: 'body', metatype: updateMetatype, data: '' },
    );
    expect(update).toMatchObject({ status: CompanyBankAccountStatus.INACTIVE });
    expect(update).not.toHaveProperty('approvalAdminId');

    const decisionMetatype = bodyMetatype('decideCompanyBankAccountChange', 2) as never;
    await expect(
      pipe.transform(
        {
          decision: ' approve ',
          operatorReason: 'Verified treasury ownership evidence',
          requestId: ' request-1 ',
        },
        { type: 'body', metatype: decisionMetatype, data: '' },
      ),
    ).resolves.toEqual({
      decision: 'APPROVE',
      operatorReason: 'Verified treasury ownership evidence',
      requestId: 'request-1',
    });
  });

  it('validates and trims bank statement batch assignment evidence', async () => {
    const metatype = bodyMetatype('assignBankReconciliationImportBatch', 2) as never;
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { assigneeAdminId: ' finance-operator-1 ', reason: ' Own overdue reconciliation ' },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.toEqual({
      assigneeAdminId: 'finance-operator-1',
      reason: 'Own overdue reconciliation',
    });
    await expect(
      pipe.transform({ assigneeAdminId: '', reason: '' }, { type: 'body', metatype, data: '' }),
    ).rejects.toThrow();
  });

  it('validates payout transfer evidence target, snapshot, and reason fields', async () => {
    const metatype = bodyMetatype('updatePayoutBatch', 2) as never;
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          confirmationPayoutBatchId: ' payout-batch-1 ',
          expectedNotes: ' old note ',
          expectedStatus: PayoutBatchStatus.DRAFT,
          expectedTransferRef: ' OLD-REF ',
          notes: ' new note ',
          reason: ' verified against the bank receipt ',
          transferRef: ' NEW-REF ',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.toEqual({
      confirmationPayoutBatchId: 'payout-batch-1',
      expectedNotes: 'old note',
      expectedStatus: PayoutBatchStatus.DRAFT,
      expectedTransferRef: 'OLD-REF',
      notes: 'new note',
      reason: 'verified against the bank receipt',
      transferRef: 'NEW-REF',
    });

    await expect(
      pipe.transform(
        { confirmationPayoutBatchId: 'payout-batch-1', reason: 'short' },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates a bounded unique notification translation batch', async () => {
    const metatype = bodyMetatype('updateNotificationTemplate', 2) as never;
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          enabled: true,
          expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
          reason: 'Reviewed customer and Partner notification copy',
          translations: [
            { body: ' {partnerName} joined. ', locale: 'en', title: ' Partner joined ' },
            { body: ' {partnerName} da tham gia. ', locale: 'vi', title: ' Doi tac da tham gia ' },
          ],
        },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.toEqual({
      enabled: true,
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      reason: 'Reviewed customer and Partner notification copy',
      translations: [
        { body: '{partnerName} joined.', locale: 'en', title: 'Partner joined' },
        { body: '{partnerName} da tham gia.', locale: 'vi', title: 'Doi tac da tham gia' },
      ],
    });
    await expect(pipe.transform({
      enabled: false,
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      reason: 'Use caller fallback while managed copy is reviewed',
    }, { type: 'body', metatype, data: '' })).resolves.toEqual({
      enabled: false,
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      reason: 'Use caller fallback while managed copy is reviewed',
    });
    await expect(pipe.transform({}, { type: 'body', metatype, data: '' })).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
          reason: 'Check duplicate locale validation',
          translations: [
            { body: 'One', locale: 'en', title: 'One' },
            { body: 'Two', locale: 'en', title: 'Two' },
          ],
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses validated DTOs for persistent manual wallet adjustment decisions', async () => {
    const createMetatype = bodyMetatype('createManualWalletAdjustmentRequest', 1) as never;
    const rejectMetatype = bodyMetatype('rejectManualWalletAdjustmentRequest', 2) as never;
    const cancelMetatype = bodyMetatype('cancelStaleManualWalletAdjustmentRequest', 2) as never;
    expect((createMetatype as { name?: string })?.name).toBe('CreateManualWalletAdjustmentRequestDto');
    expect((rejectMetatype as { name?: string })?.name).toBe('RejectManualWalletAdjustmentRequestDto');
    expect((cancelMetatype as { name?: string })?.name).toBe('CancelManualWalletAdjustmentRequestDto');

    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    await expect(
      pipe.transform(
        {
          adjustmentType: 'PARTNER_BONUS',
          amount: 100000,
          direction: 'CREDIT',
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
          ownerId: 'partner-1',
          ownerType: 'PARTNER',
          reason: 'Validated request',
        },
        { type: 'body', metatype: createMetatype, data: '' },
      ),
    ).resolves.toMatchObject({ idempotencyKey: '00000000-0000-4000-8000-000000000001' });
    await expect(
      pipe.transform(
        {
          adjustmentType: 'PARTNER_BONUS',
          amount: 100000,
          direction: 'CREDIT',
          idempotencyKey: 'not-a-uuid',
          ownerId: 'partner-1',
          ownerType: 'PARTNER',
          reason: 'Invalid request key',
        },
        { type: 'body', metatype: createMetatype, data: '' },
      ),
    ).rejects.toThrow();
    const transformed = await pipe.transform(
      { reason: '  Evidence does not support this adjustment  ', ignored: 'strip-me' },
      { type: 'body', metatype: rejectMetatype, data: '' },
    );
    expect(transformed).toEqual({ reason: 'Evidence does not support this adjustment' });
    await expect(
      pipe.transform(
        { reason: '  Wallet balance changed after this request  ', ignored: 'strip-me' },
        { type: 'body', metatype: cancelMetatype, data: '' },
      ),
    ).resolves.toEqual({ reason: 'Wallet balance changed after this request' });
    await expect(
      pipe.transform({ reason: 'too short' }, { type: 'body', metatype: cancelMetatype, data: '' }),
    ).rejects.toThrow();

    await expect(
      pipe.transform({ reason: '   ' }, { type: 'body', metatype: rejectMetatype, data: '' }),
    ).rejects.toThrow();
  });

  it('normalizes monthly tax closing remittance approval payloads', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        status: MonthlyTaxClosingStatus.PAID,
        approvalAdminId: ' finance-admin-2 ',
        remittanceTransferRef: ' VCB-TAX-202606 ',
        remittanceChannel: ' VCB_MANUAL_TRANSFER ',
        remittanceEvidenceUrl: ' https://evidence.example/remittance.pdf ',
        paidAt: ' 2026-07-01T04:30 ',
        ignoredField: 'strip-me',
      },
      { type: 'body', metatype: bodyMetatype('updateMonthlyTaxClosingStatus', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('status', MonthlyTaxClosingStatus.PAID);
    expect(transformed).toHaveProperty('approvalAdminId', 'finance-admin-2');
    expect(transformed).toHaveProperty('remittanceTransferRef', 'VCB-TAX-202606');
    expect(transformed).toHaveProperty('remittanceChannel', 'VCB_MANUAL_TRANSFER');
    expect(transformed).toHaveProperty('remittanceEvidenceUrl', 'https://evidence.example/remittance.pdf');
    expect(transformed).toHaveProperty('paidAt', '2026-07-01T04:30');
    expect(transformed).not.toHaveProperty('ignoredField');
  });

  it('normalizes manual bank reconciliation match payloads and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        paymentClearingEntryId: ' clearing-1 ',
        amount: '900000',
        currency: ' VND ',
        notes: ' matched against VCB transfer ',
        bankBalance: 123,
      },
      {
        type: 'body',
        metatype: bodyMetatype('createBankReconciliationMatch' as keyof AdminController, 2) as never,
        data: '',
      },
    );

    expect(transformed).toHaveProperty('paymentClearingEntryId', 'clearing-1');
    expect(transformed).toHaveProperty('amount', 900000);
    expect(transformed).toHaveProperty('currency', 'VND');
    expect(transformed).toHaveProperty('notes', 'matched against VCB transfer');
    expect(transformed).not.toHaveProperty('bankBalance');
  });

  it('normalizes manual company bank transaction evidence and strips browser-selected approval', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        bankAccountId: ' bank-account-1 ',
        type: CompanyBankTransactionType.INFLOW,
        amount: '900000',
        currency: ' VND ',
        occurredAt: '2026-06-30T05:00:00.000Z',
        valueDate: '2026-06-30T00:00:00.000Z',
        sourceKey: ' manual-import-1 ',
        transferRef: ' VCB-900 ',
        counterpartyName: ' Demo Customer ',
        description: ' Manual import from bank statement ',
        operatorReason: ' Reviewed against VCB evidence ',
        confirmPotentialDuplicate: true,
        importedByAdminId: 'do-not-accept',
      },
      {
        type: 'body',
        metatype: bodyMetatype('createCompanyBankTransaction' as keyof AdminController, 1) as never,
        data: '',
      },
    );

    expect(transformed).not.toHaveProperty('approvalAdminId');
    expect(transformed).toHaveProperty('bankAccountId', 'bank-account-1');
    expect(transformed).toHaveProperty('amount', 900000);
    expect(transformed).toHaveProperty('currency', 'VND');
    expect(transformed).toHaveProperty('sourceKey', 'manual-import-1');
    expect(transformed).toHaveProperty('transferRef', 'VCB-900');
    expect(transformed).toHaveProperty('operatorReason', 'Reviewed against VCB evidence');
    expect(transformed).toHaveProperty('confirmPotentialDuplicate', true);
    expect(transformed).not.toHaveProperty('importedByAdminId');

    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          bankAccountId: 'bank-account-1',
          type: CompanyBankTransactionType.INFLOW,
          amount: 900000,
          occurredAt: '2026-06-30T05:00:00.000Z',
          operatorReason: 'too short',
        },
        {
          type: 'body',
          metatype: bodyMetatype('createCompanyBankTransaction' as keyof AdminController, 1) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();
  });

  it('bounds bank statement batch rows and preserves invalid row values for preview classification', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype('previewCompanyBankTransactionBatch' as keyof AdminController, 0) as never;
    const transformed = await pipe.transform(
      {
        rows: [
          {
            rowNumber: '1',
            bankAccountId: ' bank-account-1 ',
            type: 'bad-type',
            amount: 'not-an-amount',
            occurredAt: 'not-a-date',
            transferRef: ' VCB-CSV-1 ',
            ignored: 'strip-me',
          },
        ],
      },
      { type: 'body', metatype, data: '' },
    );

    expect(transformed).toEqual({
      rows: [
        {
          rowNumber: 1,
          bankAccountId: 'bank-account-1',
          type: 'bad-type',
          amount: 'not-an-amount',
          occurredAt: 'not-a-date',
          transferRef: 'VCB-CSV-1',
        },
      ],
    });
    await expect(
      pipe.transform(
        { rows: Array.from({ length: 51 }, (_, index) => ({ rowNumber: index + 1 })) },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates and normalizes bank statement batch import provenance', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype('importCompanyBankTransactionBatch' as keyof AdminController, 1) as never;
    const sourceFileSha256 = 'A'.repeat(64);
    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        mappingPreset: 'VCB',
        operatorReason: ' Reviewed VCB statement rows ',
        rows: [
          {
            amount: '900000',
            bankAccountId: ' bank-account-1 ',
            occurredAt: '2026-07-14T01:30:15.000Z',
            rowNumber: '2',
            type: 'INFLOW',
          },
        ],
        sourceFileName: ' VCB July.csv ',
        sourceFileSha256,
      },
      { type: 'body', metatype, data: '' },
    );

    expect(transformed).toMatchObject({
      mappingPreset: 'VCB',
      operatorReason: 'Reviewed VCB statement rows',
      sourceFileName: 'VCB July.csv',
      sourceFileSha256: sourceFileSha256.toLowerCase(),
    });
    expect(transformed).not.toHaveProperty('approvalAdminId');
    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          mappingPreset: 'UNKNOWN',
          rows: [
            { amount: '1', bankAccountId: 'bank-1', occurredAt: '2026-07-14', rowNumber: 2, type: 'INFLOW' },
          ],
          sourceFileName: 'statement.csv',
          sourceFileSha256: 'not-a-sha256',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          mappingPreset: 'VCB',
          operatorReason: 'short',
          rows: [
            { amount: '1', bankAccountId: 'bank-1', occurredAt: '2026-07-14', rowNumber: 2, type: 'INFLOW' },
          ],
          sourceFileName: 'statement.csv',
          sourceFileSha256: 'a'.repeat(64),
        },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes bank reconciliation match reversal reasons and strips settlement fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        reason: '  wrong clearing entry  ',
        settlementSnapshotId: 'do-not-accept',
      },
      {
        type: 'body',
        metatype: bodyMetatype('reverseBankReconciliationMatch' as keyof AdminController, 3) as never,
        data: '',
      },
    );

    expect(transformed).toHaveProperty('reason', 'wrong clearing entry');
    expect(transformed).not.toHaveProperty('settlementSnapshotId');
  });

  it('requires approved bank transaction ignore reasons and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype('ignoreCompanyBankTransaction' as keyof AdminController, 2) as never;

    await expect(
      pipe.transform(
        {
          approvalAdminId: ' finance-admin-2 ',
          reason: ' Duplicate imported statement row ',
          bankBalance: 123,
        },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.toEqual({
      reason: 'Duplicate imported statement row',
    });
    await expect(
      pipe.transform(
        { approvalAdminId: 'finance-admin-2', reason: 'Duplicate imported statement row' },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.not.toHaveProperty('approvalAdminId');
    await expect(
      pipe.transform(
        { approvalAdminId: 'finance-admin-2', reason: '   ' },
        { type: 'body', metatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes partner bank deposit approval payloads and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        providerProfileId: ' provider-1 ',
        amount: '1000000',
        bankTransactionId: ' BIDV-20260629-001 ',
        depositDate: ' 2026-06-29T09:30:00.000Z ',
        bankAccount: ' BIDV 123456789 ',
        attachmentFileId: ' file-deposit-proof-1 ',
        notes: ' bank statement confirmed ',
        walletBalance: -170000,
      },
      { type: 'body', metatype: bodyMetatype('recordPartnerBankDeposit', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('approvalAdminId', 'finance-admin-2');
    expect(transformed).toHaveProperty('providerProfileId', 'provider-1');
    expect(transformed).toHaveProperty('amount', 1000000);
    expect(transformed).toHaveProperty('bankTransactionId', 'BIDV-20260629-001');
    expect(transformed).toHaveProperty('depositDate', '2026-06-29T09:30:00.000Z');
    expect(transformed).toHaveProperty('attachmentFileId', 'file-deposit-proof-1');
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('validates partner bank deposit requests without accepting an approver id', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = await pipe.transform(
      {
        providerProfileId: ' provider-1 ',
        amount: '1000000',
        bankTransactionId: ' BIDV-20260629-001 ',
        depositDate: ' 2026-06-29T09:30:00.000Z ',
        attachmentFileId: ' file-deposit-proof-1 ',
        approvalAdminId: 'must-be-stripped',
      },
      {
        type: 'body',
        metatype: bodyMetatype('createPartnerBankDepositRequest', 1) as never,
        data: '',
      },
    );

    expect(transformed).toMatchObject({
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      attachmentFileId: 'file-deposit-proof-1',
    });
    expect(transformed).not.toHaveProperty('approvalAdminId');
  });

  it('validates explicit Partner deposit cash-debt allocations', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = await pipe.transform(
      {
        earningId: ' earning-1 ',
        amount: '170000',
        notes: ' bank evidence allocated ',
        ledgerId: 'strip-me',
      },
      {
        type: 'body',
        metatype: bodyMetatype('allocatePartnerBankDepositCashDebt', 2) as never,
        data: '',
      },
    );

    expect(transformed).toEqual({
      earningId: 'earning-1',
      amount: 170000,
      notes: 'bank evidence allocated',
    });

    await expect(
      pipe.transform(
        { earningId: 'earning-1', amount: '170000', notes: 'too short' },
        {
          type: 'body',
          metatype: bodyMetatype('allocatePartnerBankDepositCashDebt', 2) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { earningId: 'earning-1', amount: '170000' },
        {
          type: 'body',
          metatype: bodyMetatype('allocatePartnerBankDepositCashDebt', 2) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();
  });

  it('rejects blank payout batch partner ids before settlement logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { providerProfileId: '   ', transferRef: ' weekly-001 ' },
        { type: 'body', metatype: bodyMetatype('createPayoutBatch', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('strips unsupported payout update fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        approvalAdminId: ' finance-admin-2 ',
        status: PayoutBatchStatus.PAID,
        transferRef: '  bank-001  ',
        notes: null,
        totalNetAmount: 1,
      },
      { type: 'body', metatype: bodyMetatype('updatePayoutBatch', 2) as never, data: '' },
    );

    expect(transformed).not.toHaveProperty('approvalAdminId');
    expect(transformed).toHaveProperty('status', PayoutBatchStatus.PAID);
    expect(transformed).toHaveProperty('transferRef', 'bank-001');
    expect(transformed).toHaveProperty('notes', null);
    expect(transformed).not.toHaveProperty('totalNetAmount');
  });

  it('validates payout and withdrawal reversal evidence DTOs', async () => {
    const payoutMetatype = bodyMetatype('reversePaidPayoutBatch', 2) as never;
    const withdrawalMetatype = bodyMetatype('reversePaidProviderWalletWithdrawal', 2) as never;
    expect((payoutMetatype as { name?: string })?.name).toBe('ReversePaidDisbursementDto');
    expect((withdrawalMetatype as { name?: string })?.name).toBe('ReversePaidDisbursementDto');
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          approvalAdminId: ' finance-approver-2 ',
          reason: ' bank transfer returned to company ',
          reversalReference: ' BANK-RETURN-001 ',
          attachmentUrl: ' https://storage.example/reversal.jpg ',
          unsupported: 'removed',
        },
        { type: 'body', metatype: payoutMetatype, data: '' },
      ),
    ).resolves.toEqual({
      approvalAdminId: 'finance-approver-2',
      reason: 'bank transfer returned to company',
      reversalReference: 'BANK-RETURN-001',
      attachmentUrl: 'https://storage.example/reversal.jpg',
    });

    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-approver-2',
          reason: 'short',
          reversalReference: '',
        },
        { type: 'body', metatype: withdrawalMetatype, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses concrete DTOs for service and pricing administration payloads', () => {
    expect((bodyMetatype('createServiceDurationSet', 1) as { name?: string })?.name).toBe(
      'CreateServiceDurationSetDto',
    );
    expect((bodyMetatype('createService', 1) as { name?: string })?.name).toBe('CreateAdminServiceDto');
    expect((bodyMetatype('updateService', 2) as { name?: string })?.name).toBe('UpdateAdminServiceDto');
    expect((bodyMetatype('upsertServicePayoutRule', 2) as { name?: string })?.name).toBe(
      'UpsertServicePayoutRuleDto',
    );
    expect((bodyMetatype('bulkUpsertServicePayoutRules', 2) as { name?: string })?.name).toBe(
      'BulkUpsertServicePayoutRulesDto',
    );
    expect((bodyMetatype('updateServicePayoutRule', 2) as { name?: string })?.name).toBe(
      'UpdateServicePayoutRuleDto',
    );
  });

  it('normalizes service payloads and strips unsupported pricing fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceGroupKey: ' body-massage ',
        name: '  Swedish Massage  ',
        durationMin: 60,
        basePrice: 500000,
        priceStep: 100000,
        displayOrder: 3,
        active: true,
        providerPayoutAmount: 380000,
      },
      { type: 'body', metatype: bodyMetatype('createService', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('serviceGroupKey', 'body-massage');
    expect(transformed).toHaveProperty('name', 'Swedish Massage');
    expect(transformed).not.toHaveProperty('providerPayoutAmount');
  });

  it('validates nested service duration options', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceGroupKey: ' body-massage ',
        name: '  Body Massage  ',
        priceStep: '100000',
        durations: [{ durationMin: '60', basePrice: '500000', providerPayoutAmount: '380000', hidden: true }],
      },
      { type: 'body', metatype: bodyMetatype('createServiceDurationSet', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('serviceGroupKey', 'body-massage');
    expect(transformed.durations?.[0]).toHaveProperty('durationMin', 60);
    expect(transformed.durations?.[0]).not.toHaveProperty('hidden');
  });

  it('rejects invalid service payout rule numbers before pricing logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          customerPrice: 500000,
          providerPayoutAmount: 600000,
          vatBps: 1000,
          otherCostAmount: 0,
        },
        { type: 'body', metatype: bodyMetatype('upsertServicePayoutRule', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses concrete DTOs for booking operations payloads', () => {
    expect((bodyMetatype('addBookingOpsNote', 2) as { name?: string })?.name).toBe('BookingOpsNoteDto');
    expect((bodyMetatype('markBookingNoShow', 2) as { name?: string })?.name).toBe('BookingOpsReasonDto');
    expect((bodyMetatype('expireBooking', 2) as { name?: string })?.name).toBe('BookingOpsReasonDto');
    expect((bodyMetatype('closeoutCompletedBooking', 2) as { name?: string })?.name).toBe(
      'BookingCloseoutDto',
    );
    expect((bodyMetatype('approvePostMatchCancellation', 2) as { name?: string })?.name).toBe(
      'BookingPostMatchCancellationDecisionDto',
    );
    expect((bodyMetatype('holdPostMatchCancellation', 2) as { name?: string })?.name).toBe(
      'BookingPostMatchCancellationDecisionDto',
    );
    expect((bodyMetatype('updateBookingOpsTask', 2) as { name?: string })?.name).toBe('BookingOpsTaskDto');
  });

  it('trims booking operation notes and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        note: '  Chat evidence checked  ',
        preset: 'manual-review',
        paymentStatus: 'CAPTURED',
      },
      { type: 'body', metatype: bodyMetatype('addBookingOpsNote', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'Chat evidence checked');
    expect(transformed).toHaveProperty('preset', 'manual-review');
    expect(transformed).not.toHaveProperty('paymentStatus');
  });

  it('rejects invalid booking operation task enums', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          type: 'AUTO_ASSIGN',
          status: BookingOpsTaskStatus.DONE,
          note: 'should not be accepted',
        },
        { type: 'body', metatype: bodyMetatype('updateBookingOpsTask', 2) as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        type: BookingOpsTaskType.CUSTOMER_CONTACTED,
        status: BookingOpsTaskStatus.DONE,
        note: '  reviewed  ',
      },
      { type: 'body', metatype: bodyMetatype('updateBookingOpsTask', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'reviewed');
  });

  it('uses concrete DTOs for customer and partner management payloads', () => {
    expect((bodyMetatype('addCustomerOpsNote', 2) as { name?: string })?.name).toBe('CustomerOpsNoteDto');
    expect((bodyMetatype('addProviderOpsNote', 2) as { name?: string })?.name).toBe('PartnerOpsNoteDto');
    expect((bodyMetatype('blockProviderDevice', 2) as { name?: string })?.name).toBe('AdminReasonDto');
    expect((bodyMetatype('blockProviderAccount', 2) as { name?: string })?.name).toBe('AdminReasonDto');
    expect((bodyMetatype('rejectProvider', 2) as { name?: string })?.name).toBe('AdminReasonDto');
  });

  it('uses concrete DTOs for reports, sanctions, moderation, coupons, and handoff', () => {
    expect((bodyMetatype('createProviderReport', 1) as { name?: string })?.name).toBe(
      'CreatePartnerReportDto',
    );
    expect((bodyMetatype('updateProviderReport', 2) as { name?: string })?.name).toBe(
      'UpdatePartnerReportDto',
    );
    expect((bodyMetatype('createProviderSanction', 2) as { name?: string })?.name).toBe(
      'CreatePartnerSanctionDto',
    );
    expect((bodyMetatype('moderateReview', 2) as { name?: string })?.name).toBe('ModerateReviewDto');
    expect((bodyMetatype('moderatePartnerCustomerReview', 2) as { name?: string })?.name).toBe(
      'ModeratePartnerCustomerReviewDto',
    );
    expect((bodyMetatype('createCoupon', 1) as { name?: string })?.name).toBe('CreateCouponDto');
    expect((bodyMetatype('updateCoupon', 2) as { name?: string })?.name).toBe('UpdateCouponDto');
    expect((bodyMetatype('addOperationsHandoffNote', 1) as { name?: string })?.name).toBe(
      'OperationsHandoffNoteDto',
    );
    expect((bodyMetatype('createOperationsShiftHandoff', 1) as { name?: string })?.name).toBe(
      'CreateOperationsShiftHandoffDto',
    );
  });

  it('requires an open-case count and validates structured handoff cases', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype('createOperationsShiftHandoff', 1) as never;
    const valid = {
      expectedOpenCaseCount: 1,
      incomingOperatorId: 'incoming-admin',
      note: 'Continue refund review.',
      outgoingShift: 'Evening shift',
      ownerId: 'owner-admin',
      unresolvedCases: [{ caseId: 'refund-17', queueKey: 'refund-review' }],
    };

    await expect(pipe.transform(valid, { type: 'body', metatype, data: '' })).resolves.toMatchObject(valid);
    await expect(
      pipe.transform({ ...valid, expectedOpenCaseCount: undefined }, { type: 'body', metatype, data: '' }),
    ).rejects.toThrow();
  });

  it('trims customer operation notes and strips unsupported customer fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        note: '  called customer  ',
        bookingId: null,
        walletBalance: -1000,
      },
      { type: 'body', metatype: bodyMetatype('addCustomerOpsNote', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('note', 'called customer');
    expect(transformed).toHaveProperty('bookingId', null);
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('rejects invalid report, sanction, and review enums', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          providerProfileId: 'partner-1',
          source: 'BOT',
          severity: ProviderReportSeverity.HIGH,
          category: 'kyc',
          summary: 'invalid source',
        },
        { type: 'body', metatype: bodyMetatype('createProviderReport', 1) as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { type: 'AUTO_BAN', reason: 'bad sanction type' },
        { type: 'body', metatype: bodyMetatype('createProviderSanction', 2) as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { status: 'DELETED', reportReason: 'bad review status' },
        { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('accepts admin review rating and content edits with validation', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        status: 'PUBLISHED',
        rating: '4',
        comment: '  updated review copy  ',
        reportReason: '  typo correction  ',
        unsupported: 'drop me',
      },
      { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
    );

    expect(transformed).toMatchObject({
      status: 'PUBLISHED',
      rating: 4,
      comment: 'updated review copy',
      reportReason: 'typo correction',
    });
    expect(transformed).not.toHaveProperty('unsupported');

    await expect(
      pipe.transform(
        { status: 'PUBLISHED', rating: '6' },
        { type: 'body', metatype: bodyMetatype('moderateReview', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('accepts only Partner note review metadata and strips immutable comment copy', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metatype = bodyMetatype('moderatePartnerCustomerReview', 2) as never;

    await expect(
      pipe.transform(
        {
          status: 'REPORTED',
          reason: '  Booking context requires verification  ',
          comment: 'must not be mutable',
        },
        { type: 'body', metatype, data: '' },
      ),
    ).resolves.toEqual({
      status: 'REPORTED',
      reason: 'Booking context requires verification',
    });
    await expect(
      pipe.transform({ status: 'DELETED', reason: 'invalid' }, { type: 'body', metatype, data: '' }),
    ).rejects.toThrow();
  });

  it('preserves coupon discount payloads while stripping unsupported coupon fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        code: '  first100  ',
        description: 'Launch coupon',
        discount: { type: 'fixed', amount: 100000 },
        active: true,
        createdByPhone: 'hidden',
      },
      { type: 'body', metatype: bodyMetatype('createCoupon', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('code', 'first100');
    expect(transformed).toHaveProperty('discount', { type: 'fixed', amount: 100000 });
    expect(transformed).not.toHaveProperty('createdByPhone');
  });
});
