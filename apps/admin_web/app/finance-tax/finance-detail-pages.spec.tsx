import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import BankReconciliationDetailPage from './bank-reconciliation/[id]/page';
import BookingSettlementAuditDetailPage from './booking-settlement-audit/[id]/page';
import GeneralLedgerDetailPage from './general-ledger/[id]/page';
import PaymentClearingDetailPage from './payment-clearing/[id]/page';
import SettlementReversalDetailPage from './settlement-reversals/[id]/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('finance detail pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders booking settlement audit detail with immutable accounting evidence', async () => {
    mockedAdminGet.mockResolvedValue({
      accountingJournalBatches: [
        {
          id: 'journal-batch-1',
          postedAt: '2026-06-20T10:06:00.000Z',
          sourceKey: 'journal:settlement:1',
          status: 'POSTED',
          totalCredit: 600000,
          totalDebit: 600000,
        },
      ],
      booking: {
        closedAt: '2026-06-20T10:00:00.000Z',
        createdAt: '2026-06-20T09:00:00.000Z',
        id: 'booking-1',
        scheduledStartAt: '2026-06-20T09:30:00.000Z',
        status: 'COMPLETED',
      },
      bookingId: 'booking-1',
      closedAt: null,
      companyOutputVat: 9481,
      currency: 'VND',
      customerPaymentAmount: 600000,
      customerProfile: {
        id: 'customer-1',
        user: { fullName: 'Demo Customer', id: 'user-customer-1', phone: '+84900000001' },
      },
      customerProfileId: 'customer-1',
      id: 'settlement-1',
      metadata: {
        companyCouponExpense: 60000,
        couponAccountingTreatmentSnapshot: 'MARKETING_EXPENSE',
        couponCodeSnapshot: 'WELCOME10',
        couponDiscountAmount: 60000,
        couponFundingSourceSnapshot: 'COMPANY',
        couponSettlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
      },
      monthlyPeriod: '2026-06',
      partnerPayoutAmount: 430000,
      partnerPitAmount: 12000,
      partnerTaxableRevenue: 600000,
      partnerVatAmount: 30000,
      partnerWithholdingTotal: 42000,
      paymentClearingEntries: [
        {
          amount: 600000,
          currency: 'VND',
          id: 'clearing-1',
          occurredAt: '2026-06-20T10:05:00.000Z',
          sourceKey: 'clearing:settlement:1',
          status: 'CLEARED',
          type: 'SETTLEMENT_POSTED',
        },
      ],
      paymentId: 'payment-1',
      paymentFeeFixedAmount: 1000,
      paymentFeePayer: 'HANDS',
      paymentFeePolicyVersionId: 'payment-fee-policy-card-2026',
      paymentFeeRateBps: 150,
      paymentFeeRuleSnapshot: {
        feeType: 'RATE_PLUS_FIXED',
        method: 'CARD',
        policyName: 'Card processing fee',
      },
      paymentFeeTreatment: 'OPERATING_EXPENSE',
      paymentMethod: 'CARD',
      paymentProcessingFee: 10000,
      platformFeeGross: 128000,
      platformFeeNetRevenue: 118519,
      postedAt: '2026-06-20T10:05:00.000Z',
      providerProfile: {
        displayName: 'Linh Wellness',
        id: 'provider-1',
        user: { fullName: 'Demo Partner', id: 'user-partner-1', phone: '+84900000002' },
      },
      providerProfileId: 'provider-1',
      reversalEntries: [
        {
          accountingJournalBatches: [
            {
              id: 'reversal-journal-1',
              postedAt: '2026-07-01T11:05:00.000Z',
              sourceKey: 'journal:reversal:1',
              status: 'POSTED',
            },
          ],
          id: 'reversal-1',
          occurredAt: '2026-07-01T11:00:00.000Z',
          paymentClearingEntries: [
            {
              amount: -600000,
              currency: 'VND',
              id: 'reversal-clearing-1',
              occurredAt: '2026-07-01T11:00:00.000Z',
              sourceKey: 'clearing:reversal:1',
              status: 'OPEN',
              type: 'REFUND_REVERSAL',
            },
          ],
          reason: 'Refund after payout',
          settlementStatus: 'REVERSED',
          sourceKey: 'seed-finance-smoke-reversal',
          taxStatus: 'REVERSED',
        },
      ],
      settlementStatus: 'POSTED',
      taxStatus: 'OPEN',
    });

    const page = await BookingSettlementAuditDetailPage({
      params: Promise.resolve({ id: 'settlement-1' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/booking-settlement-snapshots/settlement-1', null);
    expect(markup).toContain('Booking Settlement Audit Detail');
    expect(markup).toContain('Settlement snapshot overview');
    expect(markup).toContain('Settlement evidence hub');
    expect(markup).toContain('Accounting amount breakdown');
    expect(markup).toContain('Payment fee policy evidence');
    expect(markup).toContain('Card processing fee');
    expect(markup).toContain('Policy version');
    expect(markup).toContain('payment-fee-policy-card-2026');
    expect(markup).toContain('Rate / fixed fee');
    expect(markup).toContain('150 bps + 1.000 VND');
    expect(markup).toContain('Payer / treatment');
    expect(markup).toContain('HANDS / OPERATING_EXPENSE');
    expect(markup).toContain('Allocation check');
    expect(markup).toContain('Balanced');
    expect(markup).toContain('Delta 0 VND');
    expect(markup).toContain('Coupon and policy snapshot');
    expect(markup).toContain('Settlement journal');
    expect(markup).toContain('Payment clearing');
    expect(markup).toContain('Refund after payout reversal');
    expect(markup).toContain('Journal POSTED');
    expect(markup).toContain('Clearing CLEARED');
    expect(markup).toContain('Clearing OPEN');
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('/finance-tax/settlement-reversals/reversal-1');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/payments/payment-1');
    expect(markup).toContain('/partners/provider-1?section=full');
    expect(markup).toContain('WELCOME10');
    expect(markup).toContain('MARKETING_EXPENSE');
    expect(markup).toContain('PRE_COUPON_SERVICE_AMOUNT');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
  });

  it('renders settlement reversal detail with refund after payout evidence', async () => {
    mockedAdminGet.mockResolvedValue({
      accountingJournalBatches: [
        {
          id: 'reversal-journal-1',
          metadata: {
            partnerRefundReceivableAmount: 430000,
            refundAfterPartnerPayout: true,
          },
          postedAt: '2026-07-01T11:05:00.000Z',
          sourceKey: 'journal:reversal:1',
          status: 'POSTED',
        },
      ],
      bookingId: 'booking-1',
      companyOutputVat: -9481,
      createdAt: '2026-07-01T11:00:00.000Z',
      currency: 'VND',
      customerPaymentAmount: -600000,
      customerProfileId: 'customer-1',
      id: 'reversal-1',
      metadata: {
        refundAfterPayout: true,
        reversalReason: 'Refund after payout',
      },
      monthlyPeriod: '2026-07',
      occurredAt: '2026-07-01T11:00:00.000Z',
      originalMonthlyClosingId: 'closing-1',
      originalMonthlyPeriod: '2026-06',
      originalSettlementSnapshot: {
        id: 'settlement-1',
        monthlyPeriod: '2026-06',
        postedAt: '2026-06-20T10:05:00.000Z',
        settlementStatus: 'POSTED',
        taxStatus: 'PAID',
        booking: { closedAt: '2026-06-20T10:00:00.000Z', createdAt: '2026-06-20T09:00:00.000Z', id: 'booking-1', status: 'COMPLETED' },
        customerProfile: {
          id: 'customer-1',
          user: { fullName: 'Demo Customer', id: 'user-customer-1', phone: '+84900000001' },
        },
        providerProfile: {
          displayName: 'Linh Wellness',
          id: 'provider-1',
          user: { fullName: 'Demo Partner', id: 'user-partner-1', phone: '+84900000002' },
        },
      },
      originalSettlementSnapshotId: 'settlement-1',
      partnerPitAmount: -12000,
      partnerPayoutAmount: -430000,
      partnerTaxableRevenue: -600000,
      partnerVatAmount: -30000,
      partnerWithholdingTotal: -42000,
      paymentClearingEntries: [
        {
          amount: -600000,
          currency: 'VND',
          id: 'clearing-1',
          occurredAt: '2026-07-01T11:00:00.000Z',
          sourceKey: 'clearing:reversal:1',
          status: 'OPEN',
          type: 'REFUND_REVERSAL',
        },
      ],
      paymentId: 'payment-1',
      paymentMethod: 'CARD',
      paymentProcessingFee: -10000,
      platformFeeGross: -128000,
      platformFeeNetRevenue: -118519,
      providerEarningId: 'earning-1',
      providerProfileId: 'provider-1',
      reason: 'Refund after payout',
      settlementStatus: 'REVERSED',
      sourceKey: 'seed-finance-smoke-reversal',
      taxStatus: 'REVERSED',
      updatedAt: '2026-07-01T11:05:00.000Z',
    });

    const page = await SettlementReversalDetailPage({
      params: Promise.resolve({ id: 'reversal-1' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/booking-settlement-reversals/reversal-1', null);
    expect(markup).toContain('Settlement Reversal Detail');
    expect(markup).toContain('Refund after payout evidence');
    expect(markup).toContain('Paid payout refund');
    expect(markup).toContain('Partner receivable treatment');
    expect(markup).toContain('Partner receivable / negative wallet');
    expect(markup).toContain('Receivable amount');
    expect(markup).toContain('430.000 VND');
    expect(markup).toContain('Original settlement lock');
    expect(markup).toContain('Reversal accounting impact');
    expect(markup).toContain('Reversal allocation check');
    expect(markup).toContain('Balanced');
    expect(markup).toContain('Delta 0 VND');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-1');
    expect(markup).toContain('/finance-tax/general-ledger/reversal-journal-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/partners/provider-1?section=full');
    expect(markup).toContain('Clearing open');
    expect(markup).toContain('Journal POSTED · Clearing OPEN');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
  });

  it('renders payment clearing detail evidence and related navigation', async () => {
    mockedAdminGet.mockResolvedValue({
      amount: 650000,
      bankReconciliationMatches: [
        {
          accountingJournalEntry: {
            accountCode: '1121',
            accountName: 'Payment clearing receivable',
            batchId: 'journal-batch-1',
            id: 'journal-entry-1',
          },
          amount: 650000,
          bankTransaction: {
            amount: 650000,
            counterpartyName: 'Demo Customer',
            currency: 'VND',
            id: 'bank-transaction-1',
            occurredAt: '2026-06-20T10:00:00.000Z',
            sourceKey: 'bank:transaction:1',
            status: 'MATCHED',
            transferRef: 'BANK-IN-001',
            type: 'INFLOW',
          },
          bankTransactionId: 'bank-transaction-1',
          currency: 'VND',
          id: 'match-1',
          matchedAt: '2026-06-20T10:05:00.000Z',
          sourceKey: 'bank-match:clearing-1',
          status: 'MATCHED',
        },
      ],
      bookingId: 'booking-1',
      createdAt: '2026-06-20T09:00:00.000Z',
      currency: 'VND',
      id: 'clearing-1',
      occurredAt: '2026-06-20T09:10:00.000Z',
      payment: {
        amount: 650000,
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'payment-1',
      settlementSnapshot: {
        closedAt: null,
        companyOutputVat: 9481,
        customerPaymentAmount: 600000,
        id: 'settlement-1',
        monthlyPeriod: '2026-06',
        partnerPayoutAmount: 430000,
        partnerWithholdingTotal: 42000,
        paymentFeeFixedAmount: 1000,
        paymentFeePayer: 'HANDS',
        paymentFeePolicyVersionId: 'payment-fee-policy-card-2026',
        paymentFeeRateBps: 150,
        paymentFeeRuleSnapshot: {
          feeType: 'RATE_PLUS_FIXED',
          method: 'CARD',
          policyName: 'Card processing fee',
        },
        paymentFeeTreatment: 'OPERATING_EXPENSE',
        paymentMethod: 'CARD',
        paymentProcessingFee: 10000,
        platformFeeNetRevenue: 118519,
        postedAt: '2026-06-20T10:05:00.000Z',
        settlementStatus: 'POSTED',
        taxStatus: 'OPEN',
      },
      settlementSnapshotId: 'settlement-1',
      sourceKey: 'payment:payment-1:capture',
      status: 'CLEARED',
      type: 'CUSTOMER_PAYMENT_CAPTURED',
      updatedAt: '2026-06-20T10:05:00.000Z',
    });

    const page = await PaymentClearingDetailPage({ params: Promise.resolve({ id: 'clearing-1' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/booking-payment-clearing/clearing-1', null);
    expect(markup).toContain('Payment Clearing Detail');
    expect(markup).toContain('Clearing overview');
    expect(markup).toContain('Clearing evidence hub');
    expect(markup).toContain('Payment clearing operating path');
    expect(markup).toContain('Payment source');
    expect(markup).toContain('Clearing row');
    expect(markup).toContain('Settlement evidence');
    expect(markup).toContain('Bank closeout');
    expect(markup).toContain('Ready for closeout');
    expect(markup).toContain('Source payment');
    expect(markup).toContain('Linked settlement');
    expect(markup).toContain('Bank match status');
    expect(markup).toContain('Source key');
    expect(markup).toContain('payment:payment-1:capture');
    expect(markup).toContain('Settlement payment fee');
    expect(markup).toContain('10.000 VND');
    expect(markup).toContain('CARD · 150 bps + 1.000 VND');
    expect(markup).toContain('HANDS / OPERATING_EXPENSE');
    expect(markup).toContain('/payments/payment-1');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-1');
    expect(markup).toContain('Matched amount');
    expect(markup).toContain('Remaining amount');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('Bank reconciliation matches');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders legacy payment fee evidence without a misleading zero-rate formula', async () => {
    mockedAdminGet.mockResolvedValue({
      amount: 500000,
      bankReconciliationMatches: [],
      bookingId: 'booking-1',
      createdAt: '2026-06-20T09:00:00.000Z',
      currency: 'VND',
      id: 'clearing-legacy-1',
      occurredAt: '2026-06-20T09:10:00.000Z',
      payment: {
        amount: 500000,
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'payment-1',
      settlementSnapshot: {
        closedAt: null,
        companyOutputVat: 8000,
        currency: 'VND',
        customerPaymentAmount: 500000,
        id: 'settlement-legacy-1',
        monthlyPeriod: '2026-06',
        partnerPayoutAmount: 350000,
        partnerWithholdingTotal: 30000,
        paymentFeeFixedAmount: 0,
        paymentFeePayer: 'HANDS',
        paymentFeePolicyVersionId: null,
        paymentFeeRateBps: 0,
        paymentFeeRuleSnapshot: null,
        paymentFeeTreatment: 'OPERATING_EXPENSE',
        paymentMethod: 'CARD',
        paymentProcessingFee: 12000,
        platformFeeNetRevenue: 112000,
        postedAt: '2026-06-20T10:05:00.000Z',
        settlementStatus: 'POSTED',
        taxStatus: 'OPEN',
      },
      settlementSnapshotId: 'settlement-legacy-1',
      sourceKey: 'payment:payment-1:capture',
      status: 'OPEN',
      type: 'CUSTOMER_PAYMENT_CAPTURED',
      updatedAt: '2026-06-20T10:05:00.000Z',
    });

    const page = await PaymentClearingDetailPage({ params: Promise.resolve({ id: 'clearing-legacy-1' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement payment fee');
    expect(markup).toContain('12.000 VND');
    expect(markup).toContain('CARD · legacy/manual fee evidence');
    expect(markup).toContain('Policy snapshot missing');
    expect(markup).toContain('HANDS / OPERATING_EXPENSE');
    expect(markup).toContain('Payment clearing operating path');
    expect(markup).toContain('Match bank transaction');
    expect(markup).not.toContain('CARD · 0 bps + 0 VND');
  });

  it('renders general ledger detail journal rows and evidence links', async () => {
    mockedAdminGet.mockResolvedValue({
      _count: { entries: 2 },
      bookingId: 'booking-1',
      createdAt: '2026-06-20T09:00:00.000Z',
      currency: 'VND',
      entries: [
        {
          accountCode: '1121',
          accountName: 'Payment clearing receivable',
          amount: 650000,
          bankReconciliationMatches: [
            {
              amount: 650000,
              bankTransactionId: 'bank-transaction-1',
              currency: 'VND',
              id: 'match-1',
              matchedAt: '2026-06-20T10:05:00.000Z',
              paymentClearingEntryId: 'clearing-1',
              sourceKey: 'bank-match:journal-entry-1',
              status: 'MATCHED',
            },
          ],
          createdAt: '2026-06-20T09:10:00.000Z',
          currency: 'VND',
          id: 'journal-entry-1',
          memo: 'Customer card capture',
          side: 'DEBIT',
          sourceId: 'payment-1',
          sourceType: 'PAYMENT_CALLBACK',
        },
      ],
      id: 'journal-batch-1',
      metadata: { reconciliationDelta: 42000 },
      monthlyPeriod: '2026-06',
      payment: {
        amount: 650000,
        createdAt: '2026-06-20T09:00:00.000Z',
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'payment-1',
      postedAt: '2026-06-20T09:10:00.000Z',
      settlementSnapshot: {
        closedAt: null,
        companyOutputVat: 9481,
        currency: 'VND',
        customerPaymentAmount: 600000,
        id: 'settlement-1',
        monthlyPeriod: '2026-06',
        partnerPayoutAmount: 430000,
        partnerWithholdingTotal: 42000,
        paymentFeeFixedAmount: 1000,
        paymentFeePayer: 'HANDS',
        paymentFeePolicyVersionId: 'payment-fee-policy-card-2026',
        paymentFeeRateBps: 150,
        paymentFeeRuleSnapshot: {
          feeType: 'RATE_PLUS_FIXED',
          method: 'CARD',
          policyName: 'Card processing fee',
        },
        paymentFeeTreatment: 'OPERATING_EXPENSE',
        paymentMethod: 'CARD',
        paymentProcessingFee: 10000,
        platformFeeNetRevenue: 118519,
        postedAt: '2026-06-20T10:05:00.000Z',
        settlementStatus: 'POSTED',
        taxStatus: 'OPEN',
      },
      settlementSnapshotId: 'settlement-1',
      sourceId: 'payment-1',
      sourceKey: 'journal:payment-1',
      sourceType: 'PAYMENT_CALLBACK',
      status: 'POSTED',
      totalCredit: 650000,
      totalDebit: 650000,
      updatedAt: '2026-06-20T09:10:00.000Z',
    });

    const page = await GeneralLedgerDetailPage({ params: Promise.resolve({ id: 'journal-batch-1' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/accounting-journal-batches/journal-batch-1', null);
    expect(markup).toContain('General Ledger Detail');
    expect(markup).toContain('Journal batch overview');
    expect(markup).toContain('Journal evidence hub');
    expect(markup).toContain('Source record');
    expect(markup).toContain('Linked settlement');
    expect(markup).toContain('Settlement payment fee');
    expect(markup).toContain('10.000 VND');
    expect(markup).toContain('CARD · 150 bps + 1.000 VND');
    expect(markup).toContain('HANDS / OPERATING_EXPENSE');
    expect(markup).toContain('Bank reconciliation evidence');
    expect(markup).toContain('Double-entry check');
    expect(markup).toContain('Balanced');
    expect(markup).toContain('Monthly close blocker');
    expect(markup).toContain('Formula delta 42.000 VND');
    expect(markup).toContain('Closeout readiness');
    expect(markup).toContain('Resolve formula delta before monthly close');
    expect(markup).toContain('Debit total');
    expect(markup).toContain('Credit total');
    expect(markup).toContain('Balance delta');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('Journal entries');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-1');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders bank reconciliation detail and locks manual match controls for fully matched rows', async () => {
    mockedAdminGet.mockResolvedValue({
      amount: 650000,
      bankAccount: {
        accountNumberMasked: '****1234',
        bankName: 'Vietcombank',
        currency: 'VND',
        id: 'bank-account-1',
        name: 'HANDS Operating',
        status: 'ACTIVE',
      },
      bankAccountId: 'bank-account-1',
      counterpartyName: 'Demo Customer',
      createdAt: '2026-06-20T10:00:00.000Z',
      currency: 'VND',
      description: 'Card payout clearing',
      id: 'bank-transaction-1',
      occurredAt: '2026-06-20T10:00:00.000Z',
      reconciliationMatches: [
        {
          accountingJournalEntry: {
            accountCode: '1121',
            accountName: 'Payment clearing receivable',
            amount: 650000,
            batchId: 'journal-batch-1',
            currency: 'VND',
            id: 'journal-entry-1',
            side: 'DEBIT',
          },
          accountingJournalEntryId: 'journal-entry-1',
          amount: 650000,
          currency: 'VND',
          id: 'match-1',
          matchedAt: '2026-06-20T10:05:00.000Z',
          paymentClearingEntry: {
            amount: 650000,
            bookingId: 'booking-1',
            currency: 'VND',
            id: 'clearing-1',
            occurredAt: '2026-06-20T09:10:00.000Z',
            sourceKey: 'payment:payment-1:capture',
            status: 'CLEARED',
            type: 'CUSTOMER_PAYMENT_CAPTURED',
          },
          paymentClearingEntryId: 'clearing-1',
          sourceKey: 'bank-match:bank-transaction-1',
          status: 'MATCHED',
        },
      ],
      sourceKey: 'bank:transaction:1',
      status: 'MATCHED',
      transferRef: 'BANK-IN-001',
      type: 'INFLOW',
      updatedAt: '2026-06-20T10:05:00.000Z',
      valueDate: '2026-06-20T00:00:00.000Z',
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/bank-reconciliation/bank-transaction-1', null);
    expect(markup).toContain('Bank Reconciliation Detail');
    expect(markup).toContain('Bank transaction overview');
    expect(markup).toContain('Bank evidence hub');
    expect(markup).toContain('Bank reconciliation operating path');
    expect(markup).toContain('Finance source');
    expect(markup).toContain('Ledger evidence');
    expect(markup).toContain('Ready for closeout');
    expect(markup).toContain('Matched finance source');
    expect(markup).toContain('Payment clearing evidence');
    expect(markup).toContain('Journal evidence');
    expect(markup).toContain('Transfer reference');
    expect(markup).toContain('BANK-IN-001');
    expect(markup).toContain('Source key');
    expect(markup).toContain('bank:transaction:1');
    expect(markup).toContain('Card payout clearing');
    expect(markup).toContain('Matched amount');
    expect(markup).toContain('Remaining amount');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('Manual reconciliation match');
    expect(markup).toContain('card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card');
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('Manual reconciliation match');
    expect(markup).toContain('This bank transaction is already fully reconciled.');
    expect(markup).not.toContain('Create match');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders manual match controls for unmatched bank reconciliation rows', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/bank-transaction-1') {
        return {
          amount: 650000,
          bankAccount: {
            accountNumberMasked: '****1234',
            bankName: 'Vietcombank',
            currency: 'VND',
            id: 'bank-account-1',
            name: 'HANDS Operating',
            status: 'ACTIVE',
          },
          bankAccountId: 'bank-account-1',
          counterpartyName: 'Demo Customer',
          createdAt: '2026-06-20T10:00:00.000Z',
          currency: 'VND',
          description: 'Card payout clearing',
          id: 'bank-transaction-1',
          occurredAt: '2026-06-20T10:00:00.000Z',
          reconciliationMatches: [],
          sourceKey: 'bank:transaction:1',
          status: 'UNMATCHED',
          transferRef: 'BANK-IN-001',
          type: 'INFLOW',
          updatedAt: '2026-06-20T10:05:00.000Z',
          valueDate: '2026-06-20T00:00:00.000Z',
        };
      }
      if (href === '/admin/booking-payment-clearing?range=30d&take=50&review=open') {
        return [
          {
            amount: 400000,
            bookingId: 'booking-mismatch',
            currency: 'VND',
            id: 'clearing-mismatch',
            occurredAt: '2026-06-20T09:15:00.000Z',
            payment: {
              amount: 400000,
              currency: 'VND',
              id: 'payment-mismatch',
              method: 'CARD',
              status: 'CAPTURED',
            },
            paymentId: 'payment-mismatch',
            sourceKey: 'payment:payment-mismatch:capture',
            status: 'OPEN',
            type: 'SETTLEMENT_POSTED',
          },
          {
            amount: 650000,
            bookingId: 'booking-exact',
            currency: 'VND',
            id: 'clearing-exact',
            occurredAt: '2026-06-20T09:10:00.000Z',
            payment: {
              amount: 650000,
              currency: 'VND',
              id: 'payment-exact',
              method: 'CARD',
              status: 'CAPTURED',
            },
            paymentId: 'payment-exact',
            sourceKey: 'payment:payment-exact:capture',
            status: 'OPEN',
            type: 'CUSTOMER_PAYMENT_CAPTURED',
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/booking-payment-clearing?range=30d&take=50&review=open', []);
    expect(markup).toContain('Manual reconciliation match');
    expect(markup).toContain('Payment clearing candidate');
    expect(markup).toContain('Create explicit match');
    expect(markup).toContain('Pending journal evidence');
    expect(markup).toContain('Exact amount - CUSTOMER_PAYMENT_CAPTURED - 650.000 VND - booking');
    expect(markup.indexOf('Exact amount - CUSTOMER_PAYMENT_CAPTURED')).toBeLessThan(
      markup.indexOf('SETTLEMENT_POSTED - 400.000 VND'),
    );
    expect(markup).toContain('type="hidden" name="sourceType" value="payment-clearing"');
    expect(markup).toContain('name="sourceId"');
    expect(markup).toContain('Create match');
    expect(markup).not.toContain('This bank transaction is already fully reconciled.');
  });

  it('separates active bank reconciliation evidence from reversed match history', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/bank-transaction-1') {
        return {
          amount: 650000,
          bankAccount: {
            accountNumberMasked: '****1234',
            bankName: 'Vietcombank',
            currency: 'VND',
            id: 'bank-account-1',
            name: 'HANDS Operating',
            status: 'ACTIVE',
          },
          bankAccountId: 'bank-account-1',
          counterpartyName: 'Demo Customer',
          createdAt: '2026-06-20T10:00:00.000Z',
          currency: 'VND',
          description: 'Card payout clearing',
          id: 'bank-transaction-1',
          occurredAt: '2026-06-20T10:00:00.000Z',
          reconciliationMatches: [
            {
              amount: 650000,
              currency: 'VND',
              id: 'match-1',
              matchedAt: '2026-06-20T10:05:00.000Z',
              metadata: { reversalReason: 'Incorrect bank evidence selected.' },
              paymentClearingEntry: {
                amount: 650000,
                bookingId: 'booking-1',
                currency: 'VND',
                id: 'clearing-1',
                occurredAt: '2026-06-20T09:10:00.000Z',
                sourceKey: 'payment:payment-1:capture',
                status: 'OPEN',
                type: 'CUSTOMER_PAYMENT_CAPTURED',
              },
              paymentClearingEntryId: 'clearing-1',
              sourceKey: 'bank-match:bank-transaction-1',
              status: 'REVERSED',
            },
          ],
          sourceKey: 'bank:transaction:1',
          status: 'UNMATCHED',
          transferRef: 'BANK-IN-001',
          type: 'INFLOW',
          updatedAt: '2026-06-20T10:05:00.000Z',
          valueDate: '2026-06-20T00:00:00.000Z',
        };
      }
      if (href === '/admin/booking-payment-clearing?range=30d&take=50&review=open') {
        return [
          {
            amount: 650000,
            bookingId: 'booking-1',
            currency: 'VND',
            id: 'clearing-1',
            occurredAt: '2026-06-20T09:10:00.000Z',
            sourceKey: 'payment:payment-1:capture',
            status: 'OPEN',
            type: 'CUSTOMER_PAYMENT_CAPTURED',
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Matched finance source');
    expect(markup).toContain('No active matched source');
    expect(markup).toContain('Last reversed source');
    expect(markup).toContain('REVERSED · bank-mat');
    expect(markup).toContain('Review reversed evidence');
    expect(markup).toContain('Reversal reason');
    expect(markup).toContain('Incorrect bank evidence selected.');
    expect(markup).toContain('Create match');
  });
});
