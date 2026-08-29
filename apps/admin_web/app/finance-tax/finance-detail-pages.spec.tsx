import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, adminGetResult } from '../../lib/admin-api';
import type { AdminBookingSettlementReversalEntry } from '../../lib/admin-api';
import BankReconciliationDetailPage from './bank-reconciliation/[id]/page';
import BookingSettlementAuditDetailPage from './booking-settlement-audit/[id]/page';
import GeneralLedgerDetailPage from './general-ledger/[id]/page';
import PaymentClearingDetailPage from './payment-clearing/[id]/page';
import SettlementReversalDetailPage, {
  payoutRefundReceivableEvidence,
} from './settlement-reversals/[id]/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('finance detail pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
  });

  it('renders an explicit settlement reversal upstream error instead of a not-found conclusion', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: null, ok: false, status: 500 });

    const page = await SettlementReversalDetailPage({
      params: Promise.resolve({ id: 'reversal-upstream-failure' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement reversal evidence unavailable');
    expect(markup).toContain('No closeout conclusion has been inferred');
    expect(markup).not.toContain('Evidence complete');
  });

  it('scopes finance operating path typography to direct path-node children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.finance-reconciliation-path-node > span');
    expect(css).toContain('.finance-reconciliation-path-node > small');
    expect(css).toContain('.finance-reconciliation-path-node > strong');
    expect(css).not.toContain('.finance-reconciliation-path-node span,');
    expect(css).not.toContain('.finance-reconciliation-path-node small {');
    expect(css).not.toContain('.finance-reconciliation-path-node strong {');
  });

  it('renders booking settlement audit detail with immutable accounting evidence', async () => {
    mockedAdminGet.mockResolvedValue({
      accountingJournalBatches: [
        {
          id: 'journal-batch-1',
          postedAt: '2026-06-20T10:06:00.000Z',
          sourceKey: 'journal:settlement:1',
          sourceType: 'BOOKING_SETTLEMENT',
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
        settlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
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
      settlementAuditHealth: {
        allocation: {
          companyCouponExpense: 60000,
          customerPaymentAmount: 600000,
          delta: 0,
          partnerPayoutAmount: 430000,
          partnerWithholdingTotal: 42000,
          platformFeeGross: 128000,
        },
        blockers: [
          {
            code: 'REVERSAL_CLEARING_OPEN',
            nextAction: 'Resolve reversal clearing before closeout.',
            ownerTeam: 'Payment Operations',
            severity: 'BLOCKER',
          },
        ],
        checkedAt: '2026-07-01T11:05:00.000Z',
        checks: {
          allocation: 'PASS',
          bankMatch: 'PASS',
          canonicalClearing: 'PASS',
          canonicalJournal: 'PASS',
          couponPolicy: 'PASS',
          paymentFeePolicy: 'PASS',
          reversal: 'FAIL',
          taxPeriod: 'FAIL',
        },
        evidence: {
          canonicalClearing: {
            count: 1,
            ids: ['clearing-1'],
            matchedAmount: 600000,
            required: true,
            state: 'PASS',
            unmatchedAmount: 0,
          },
          canonicalJournal: { count: 1, ids: ['journal-batch-1'], state: 'PASS' },
          reversal: {
            clearingCount: 1,
            count: 1,
            ids: ['reversal-1'],
            journalCount: 1,
            lifecycle: 'CLOSED_PERIOD',
            reason: 'Refund after payout',
            reversedAt: '2026-07-01T11:00:00.000Z',
            reversalPeriod: '2026-07',
            state: 'FAIL',
          },
        },
        formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
        state: 'ACTION_REQUIRED',
      },
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

    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/booking-settlement-snapshots/settlement-1', null);
    expect(markup).toContain('Booking Settlement Audit Detail');
    expect(markup).toContain('Action checklist');
    expect(markup).toContain('Identity');
    expect(markup).toContain('Booking settlement operating path');
    expect(markup).toContain('Customer payment');
    expect(markup).toContain('Settlement split');
    expect(markup).toContain('Canonical evidence');
    expect(markup).toContain('Reversal lifecycle');
    expect(markup).toContain('Resolve reversal clearing before closeout.');
    expect(markup).toContain('Allocation equation');
    expect(markup).toContain('Payment fee policy evidence');
    expect(markup).toContain('Card processing fee');
    expect(markup).toContain('Policy version');
    expect(markup).toContain('payment-fee-policy-card-2026');
    expect(markup).toContain('Rate / fixed fee');
    expect(markup).toContain('150 bps +');
    expect(markup).toContain('1.000 VND');
    expect(markup).toContain('Payer / treatment');
    expect(markup).toContain('HANDS / OPERATING_EXPENSE');
    expect(markup).toContain('Allocation delta');
    expect(markup).toContain('Allocation verified');
    expect(markup).toContain('Delta');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('Coupon and policy record');
    expect(markup).toContain('Canonical settlement journal');
    expect(markup).toContain('Canonical payment clearing');
    expect(markup).toContain('Reversal evidence');
    expect(markup).toContain('Journal posted');
    expect(markup).toContain('Clearing complete');
    expect(markup).toContain('Clearing open');
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
          integrity: {
            blockerCodes: ['HEADER_ENTRY_MISMATCH', 'FORMULA_DELTA'],
            checkedAt: '2026-08-26T00:00:00.000Z',
            checks: {
              entriesBalanced: 'PASS',
              formula: 'FAIL',
              headerBalanced: 'PASS',
              headerMatchesEntries: 'FAIL',
              monthlyPeriod: 'PASS',
              postedEntries: 'PASS',
            },
            discrepancyAmount: 110000,
            entryCount: 4,
            entryCredit: 390000,
            entryDebit: 390000,
            formulaDelta: 12000,
            state: 'BLOCKED',
          },
          metadata: {
            partnerRefundReceivableAmount: 430000,
            refundAfterPartnerPayout: true,
          },
          postedAt: '2026-07-01T11:05:00.000Z',
          sourceKey: 'journal:reversal:1',
          status: 'POSTED',
          totalCredit: 500000,
          totalDebit: 500000,
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
        booking: {
          closedAt: '2026-06-20T10:00:00.000Z',
          createdAt: '2026-06-20T09:00:00.000Z',
          id: 'booking-1',
          status: 'COMPLETED',
        },
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
          bankReconciliationMatches: [
            {
              amount: -250000,
              bankTransactionId: 'bank-transaction-1',
              bankTransaction: {
                amount: -250000,
                counterpartyName: 'Demo Customer',
                currency: 'VND',
                id: 'bank-transaction-1',
                occurredAt: '2026-07-01T11:05:00.000Z',
                sourceKey: 'bank:refund:1',
                status: 'PARTIALLY_MATCHED',
                transferRef: 'REFUND-001',
                type: 'OUTFLOW',
              },
              currency: 'VND',
              id: 'bank-match-1',
              matchedAt: '2026-07-01T11:06:00.000Z',
              sourceKey: 'bank-match:refund:1',
              status: 'PARTIALLY_MATCHED',
            },
          ],
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
      reversalEvidence: {
        bankMatchState: 'FAIL',
        blockerCodes: ['REVERSAL_STATUS_MISMATCH', 'BANK_MATCH_INCOMPLETE'],
        clearingState: 'FAIL',
        journalState: 'FAIL',
        ledgerState: 'NOT_APPLICABLE',
        matchedAmount: 250000,
        policy: { externalClearingRequired: true, ledgerType: 'EXTERNAL_CLEARING' },
        state: 'FAIL',
        unmatchedAmount: 350000,
      },
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
    expect(markup).toContain('Settlement reversal evidence');
    expect(markup).toContain('Reversal ID reversal');
    expect(markup).not.toContain('Reversal reversal ·');
    expect(markup).toContain('Settlement reversal operating path');
    expect(markup).toContain('Original settlement');
    expect(markup).toContain('Reversal impact');
    expect(markup).toContain('Journal / clearing');
    expect(markup).toContain('Closeout action');
    expect(markup).toContain('Next closeout action');
    expect(markup).toContain('Clearing FAIL');
    expect(markup).toContain('Paid payout refund');
    expect(markup).toContain('Partner receivable treatment');
    expect(markup).toContain('Partner receivable / negative wallet');
    expect(markup).toContain('Receivable amount');
    expect(markup).toContain('430.000 VND');
    expect(markup).toContain('Paid payout and receivable evidence retained');
    expect(markup).toContain('Journal integrity check');
    expect(markup).toContain('Header debit');
    expect(markup).toContain('Entry credit');
    expect(markup).toContain('Maximum discrepancy');
    expect(markup).toContain('110.000 VND');
    expect(markup).toContain('Formula delta');
    expect(markup).toContain('12.000 VND');
    expect(markup).toContain('Bank clearing check');
    expect(markup).toContain('Reversal journal record');
    expect(markup).toContain('Payment clearing record');
    expect(markup).toContain('Matched');
    expect(markup).toContain('250.000 VND');
    expect(markup).toContain('Remaining');
    expect(markup).toContain('350.000 VND');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('REFUND-001');
    expect(markup).toContain('PARTIALLY_MATCHED');
    expect(markup).toContain('bank-match:refund:1');
    expect(markup).toContain('Original settlement lock');
    expect(markup).toContain('Original tax PAID lock');
    expect(markup).toContain('Correction method');
    expect(markup).toContain('Reversal entry only');
    expect(markup).toContain('Direct edit allowed');
    expect(markup).toContain('No');
    expect(markup).toContain('/finance-tax/monthly-tax-closing?period=2026-06');
    expect(markup).toContain('/finance-tax/monthly-tax-closing?period=2026-07');
    expect(markup).toContain('Original monthly close');
    expect(markup).toContain('Reversal monthly close');
    expect(markup).toContain('Original tax PAID');
    expect(markup).toContain('Reversal tax REVERSED');
    expect(markup).toContain('Monthly closing closing-1');
    expect(markup).toContain('Reversal record seed-finance-smoke-reversal');
    expect(markup).not.toContain('Reversal source seed-finance-smoke-reversal');
    expect(markup).toContain('Record key');
    expect(markup).not.toContain('Source key');
    expect(markup).toContain(
      'Open each evidence record to compare the original monthly close, reversal monthly close, journal, clearing, bank match, and original settlement record.',
    );
    expect(markup).toContain('Reversal accounting impact');
    expect(markup).toContain('Reversal allocation check');
    expect(markup).toContain('Amounts offset');
    expect(markup).not.toContain('Balanced');
    expect(markup).toContain('Delta');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-1');
    expect(markup).toContain('/finance-tax/general-ledger/reversal-journal-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/partners/provider-1?section=full');
    expect(markup).toContain('Clearing FAIL');
    expect(markup).toContain(
      'Journal POSTED · Integrity BLOCKED · Ledger NOT_APPLICABLE · Clearing FAIL · Bank FAIL',
    );
    expect(markup).toContain('Journal blocked');
    expect(markup).not.toContain('Evidence complete');
    expect(markup).not.toContain('Ready for closeout review');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
  });

  it('does not infer partner receivable treatment from reason text or contradictory metadata', () => {
    const reversal = {
      accountingJournalBatches: [
        {
          id: 'journal-1',
          metadata: { partnerRefundReceivableAmount: 390000, refundAfterPartnerPayout: true },
        },
      ],
      metadata: {},
      partnerPayoutAmount: -390000,
      reason: 'Refund after payout',
    } as AdminBookingSettlementReversalEntry;

    expect(payoutRefundReceivableEvidence(reversal)).toEqual({
      evidenceLabel: 'Paid payout and receivable evidence retained',
      receivableAmount: 390000,
      refundAfterPaidPayout: true,
      treatment: 'Partner receivable / negative wallet',
    });
    expect(
      payoutRefundReceivableEvidence({
        ...reversal,
        accountingJournalBatches: [{ id: 'journal-1', metadata: { refundAfterPartnerPayout: false } }],
      } as AdminBookingSettlementReversalEntry),
    ).toEqual({
      evidenceLabel: 'Unpaid payout liability reversal retained',
      receivableAmount: 0,
      refundAfterPaidPayout: false,
      treatment: 'Partner wallet liability reversal',
    });
    expect(
      payoutRefundReceivableEvidence({
        ...reversal,
        metadata: { refundAfterPayout: false },
      } as AdminBookingSettlementReversalEntry),
    ).toEqual({
      evidenceLabel: 'Contradictory retained payout evidence — review required',
      receivableAmount: null,
      refundAfterPaidPayout: null,
      treatment: 'Partner receivable treatment unknown',
    });
    expect(
      payoutRefundReceivableEvidence({
        ...reversal,
        accountingJournalBatches: [{ id: 'journal-legacy-1' }],
      } as AdminBookingSettlementReversalEntry),
    ).toEqual({
      evidenceLabel: 'Retained payout evidence unavailable — review required',
      receivableAmount: null,
      refundAfterPaidPayout: null,
      treatment: 'Partner receivable treatment unknown',
    });
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
    expect(markup).toContain('Payment record');
    expect(markup).not.toContain('Payment source');
    expect(markup).toContain('Clearing row');
    expect(markup).toContain('Settlement evidence');
    expect(markup).toContain('Bank closeout');
    expect(markup).toContain('Ready for closeout');
    expect(markup).toContain('Payment record');
    expect(markup).not.toContain('Source payment');
    expect(markup).toContain('Linked settlement');
    expect(markup).toContain('Bank match status');
    expect(markup).toContain('Record key');
    expect(markup).not.toContain('Source key');
    expect(markup).not.toContain('Settlement trace');
    expect(markup).not.toContain('No settlement trace');
    expect(markup).not.toContain('linked trace(s)');
    expect(markup).toContain('payment:payment-1:capture');
    expect(markup).toContain('Settlement payment fee');
    expect(markup).toContain('10.000 VND');
    expect(markup).toContain('CARD · 150 bps +');
    expect(markup).toContain('1.000 VND');
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
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card',
    );
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
    expect(markup).toContain('Policy record missing');
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
      integrity: {
        blockerCodes: ['FORMULA_DELTA'],
        checkedAt: '2026-08-09T00:00:00.000Z',
        checks: {
          entriesBalanced: 'PASS',
          formula: 'FAIL',
          headerBalanced: 'PASS',
          headerMatchesEntries: 'PASS',
          monthlyPeriod: 'PASS',
          postedEntries: 'PASS',
        },
        discrepancyAmount: 42000,
        entryCount: 2,
        entryCredit: 650000,
        entryDebit: 650000,
        formulaDelta: 42000,
        state: 'BLOCKED',
      },
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
    expect(markup).toContain('Journal Batch Detail');
    expect(markup).toContain('Journal batch overview');
    expect(markup).toContain('Journal evidence hub');
    expect(markup).toContain('Journal batch operating path');
    expect(markup).toContain('Finance record');
    expect(markup).not.toContain('Finance source');
    expect(markup).toContain('Journal batch');
    expect(markup).toContain('Entry balance');
    expect(markup).toContain('Entry debit = credit · Pass');
    expect(markup).toContain('Monthly close');
    expect(markup).toContain('Resolve recorded integrity blockers');
    expect(markup).toContain('Finance record');
    expect(markup).not.toContain('Source record');
    expect(markup).toContain('Linked settlement');
    expect(markup).toContain('Settlement payment fee');
    expect(markup).toContain('10.000 VND');
    expect(markup).toContain('Recorded fee');
    expect(markup).toContain('Method');
    expect(markup).toContain('Basis');
    expect(markup).toContain('150 bps +');
    expect(markup).toContain('1.000 VND');
    expect(markup).toContain('Policy');
    expect(markup).toContain('Payer');
    expect(markup).toContain('Treatment');
    expect(markup).toContain('HANDS');
    expect(markup).toContain('OPERATING_EXPENSE');
    expect(markup).toContain('Bank reconciliation evidence');
    expect(markup).toContain('Integrity result');
    expect(markup).toContain('BLOCKED');
    expect(markup).toContain('Closeout blockers');
    expect(markup).toContain('Operator next action');
    expect(markup).toContain('Compare the retained settlement allocation and fee or tax evidence with the journal entries.');
    expect(markup).toContain('Open settlement record');
    expect(markup).toContain('No journal values are changed from this screen.');
    expect(markup).toContain('Formula delta');
    expect(markup).toContain('42.000 VND');
    expect(markup).toContain('Monthly close status');
    expect(markup).not.toContain('Closeout readiness');
    expect(markup).not.toContain('Settlement trace');
    expect(markup).not.toContain('linked trace(s)');
    expect(markup).not.toContain('Source key');
    expect(markup).toContain('Blocked until integrity discrepancies are resolved');
    expect(markup).toContain('Header debit');
    expect(markup).toContain('Entry debit');
    expect(markup).toContain('Maximum discrepancy');
    expect(markup).toContain('Journal batch entries');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-1');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card',
    );
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('general-ledger-technical-id');
    expect(markup).toContain('Payment Callback');
    expect(markup).toContain('PAYMENT_CALLBACK');
  });

  it('renders paid-disbursement reversal evidence without exposing raw metadata', async () => {
    mockedAdminGet.mockResolvedValue({
      bookingId: null,
      currency: 'VND',
      entries: [
        {
          accountCode: 'company_bank_cash',
          accountName: 'Company bank cash',
          amount: 120000,
          bankReconciliationMatches: [],
          createdAt: '2026-07-16T10:00:00.000Z',
          currency: 'VND',
          id: 'journal-entry-reversal-1',
          memo: 'Reversal of paid withdrawal',
          side: 'DEBIT',
          sourceId: 'withdrawal-1',
          sourceType: 'PROVIDER_WITHDRAWAL',
        },
        {
          accountCode: 'partner_wallet_liability',
          accountName: 'Partner wallet liability',
          amount: 120000,
          bankReconciliationMatches: [],
          createdAt: '2026-07-16T10:00:00.000Z',
          currency: 'VND',
          id: 'journal-entry-reversal-2',
          memo: 'Reversal of withdrawal lock',
          side: 'CREDIT',
          sourceId: 'withdrawal-1',
          sourceType: 'PROVIDER_WITHDRAWAL',
        },
      ],
      id: 'journal-withdrawal-reversal-1',
      integrity: {
        blockerCodes: [],
        checkedAt: '2026-08-09T00:00:00.000Z',
        checks: {
          entriesBalanced: 'PASS',
          formula: 'NOT_APPLICABLE',
          headerBalanced: 'PASS',
          headerMatchesEntries: 'PASS',
          monthlyPeriod: 'PASS',
          postedEntries: 'PASS',
        },
        discrepancyAmount: 0,
        entryCount: 2,
        entryCredit: 120000,
        entryDebit: 120000,
        formulaDelta: null,
        state: 'CLEAR',
      },
      monthlyPeriod: '2026-07',
      operatorEvidence: {
        approval: {
          action: 'payment.refund.approval.claim',
          approvedAt: '2026-07-16T09:55:00.000Z',
          approvalAdminId: 'finance-approver-1',
          approver: {
            email: 'finance.approver@hands.test',
            fullName: 'Finance Approver',
            id: 'finance-approver-1',
            roles: ['ADMIN', 'FINANCE_APPROVER'],
          },
          paymentId: 'payment-refund-1',
          refundId: 'refund-1',
          requestedByAdminId: 'requester-1',
        },
        recordedBy: {
          email: 'finance.operator@hands.test',
          fullName: 'Finance Operator',
          id: 'finance-operator-2',
          roles: ['ADMIN', 'FINANCE_APPROVER'],
        },
        recordedByAdminId: 'finance-operator-2',
      },
      payment: null,
      postedAt: '2026-07-16T10:00:00.000Z',
      settlementReversalEntry: {
        companyOutputVat: 0,
        createdById: 'finance-operator-2',
        currency: 'VND',
        customerPaymentAmount: 120000,
        id: 'settlement-reversal-1',
        monthlyPeriod: '2026-07',
        occurredAt: '2026-07-16T10:00:00.000Z',
        originalMonthlyClosingId: 'monthly-close-2026-07',
        originalMonthlyPeriod: '2026-07',
        originalSettlementSnapshotId: 'settlement-original-1',
        partnerPayoutAmount: 100000,
        partnerWithholdingTotal: 0,
        paymentMethod: 'CARD',
        paymentProcessingFee: 0,
        platformFeeNetRevenue: 20000,
        reason: 'The receiving bank returned the transfer.',
        settlementStatus: 'REVERSED',
        taxStatus: 'OPEN',
      },
      settlementSnapshot: null,
      sourceId: 'withdrawal-1',
      sourceKey: 'accounting-journal:provider-withdrawal:withdrawal-1:reversal',
      sourceType: 'PROVIDER_WITHDRAWAL',
      status: 'POSTED',
      totalCredit: 120000,
      totalDebit: 120000,
      updatedAt: '2026-07-16T10:00:00.000Z',
    });

    const page = await GeneralLedgerDetailPage({
      params: Promise.resolve({ id: 'journal-withdrawal-reversal-1' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Original settlement');
    expect(markup).toContain('/finance-tax/booking-settlement-audit/settlement-original-1');
    expect(markup).toContain('Reversal reason');
    expect(markup).toContain('The receiving bank returned the transfer.');
    expect(markup).toContain('Reversal posted');
    expect(markup).toContain('Reversal recorded by');
    expect(markup).toContain('Finance Operator');
    expect(markup).toContain('finance.operator@hands.test');
    expect(markup).toContain('ADMIN, FINANCE_APPROVER');
    expect(markup).toContain('Finance Approver');
    expect(markup).toContain('finance.approver@hands.test');
    expect(markup).toContain('Approved');
    expect(markup).toContain('Refund refund-1');
    expect(markup).toContain('Payment payment-');
    expect(markup).not.toContain('Approval evidence unavailable');
    expect(markup).not.toContain('finance-operator-2');
    expect(markup).not.toContain('No canonical approval field is recorded on this reversal.');
    expect(markup).not.toContain('BANK-RETURN-501');
  });

  it('separates an unavailable journal detail API from a missing journal batch', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({ data: null, ok: false, status: 503 });

    const unavailablePage = await GeneralLedgerDetailPage({
      params: Promise.resolve({ id: 'journal-unavailable' }),
    });
    const unavailableMarkup = renderToStaticMarkup(unavailablePage);

    expect(unavailableMarkup).toContain('Journal batch unavailable');
    expect(unavailableMarkup).toContain('No integrity or zero-balance assumption has been made.');

    mockedAdminGetResult.mockResolvedValueOnce({ data: null, ok: false, status: 404 });
    await expect(
      GeneralLedgerDetailPage({ params: Promise.resolve({ id: 'journal-missing' }) }),
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('renders journal detail permission failures without treating them as missing records', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({ data: null, ok: false, status: 403 });

    const page = await GeneralLedgerDetailPage({
      params: Promise.resolve({ id: 'journal-forbidden' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Journal batch permission required');
    expect(markup).toContain('does not have permission');
    expect(markup).not.toContain('Journal batch unavailable');
  });

  it('renders bank reconciliation detail and locks manual match controls for fully matched rows', async () => {
    const transaction = {
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
    };
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      return String(href).includes('/admin/users') ? fallback : transaction;
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/bank-transaction-1?candidatePage=1&candidateTake=25',
      null,
    );
    expect(markup).toContain('Bank Reconciliation Detail');
    expect(markup).toContain('Bank transaction overview');
    expect(markup).toContain('Bank evidence hub');
    expect(markup).toContain('Bank reconciliation operating path');
    expect(markup).toContain('Finance source');
    expect(markup).toContain('Ledger evidence');
    expect(markup).toContain('No action required');
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
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card',
    );
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('finance-reconciliation-source-cell');
    expect(markup).toContain('finance-reconciliation-reverse-form');
    expect(markup).toContain('Review match reversal');
    expect(markup).toContain('Confirm reversal');
    expect(markup).toContain('Reversal reason');
    expect(markup).not.toContain('Manual reconciliation match');
    expect(markup).not.toContain('Create match');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders manual match controls for unmatched bank reconciliation rows', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/bank-transaction-1?candidatePage=1&candidateTake=25') {
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
          paymentClearingCandidates: [
            {
              amount: 650000,
              amountDelta: 0,
              bookingId: 'booking-exact',
              bookingStatus: 'OPEN_MATCHING',
              confidence: 'STRONG',
              currency: 'VND',
              customerLabel: 'Demo Customer',
              dateDeltaDays: 0,
              eligible: true,
              exactAmount: true,
              exclusionReasons: [],
              id: 'clearing-exact',
              occurredAt: '2026-06-20T09:10:00.000Z',
              paymentMethod: 'CARD',
              paymentProviderRef: 'BANK-IN-001',
              paymentStatus: 'CAPTURED',
              reasons: [
                'Transfer reference matches the payment provider reference',
                'Remaining clearing amount matches exactly',
              ],
              remainingAmount: 650000,
              sourceKey: 'payment:payment-exact:capture',
              transferRefMatch: true,
              type: 'CUSTOMER_PAYMENT_CAPTURED',
            },
            {
              amount: 600000,
              amountDelta: 50000,
              bookingId: 'booking-review',
              bookingStatus: 'OPEN_MATCHING',
              confidence: 'REVIEW',
              currency: 'VND',
              customerLabel: 'Review Customer',
              dateDeltaDays: 2,
              eligible: true,
              exactAmount: false,
              exclusionReasons: [],
              id: 'clearing-review',
              occurredAt: '2026-06-18T09:10:00.000Z',
              paymentMethod: 'CARD',
              paymentProviderRef: null,
              paymentStatus: 'CAPTURED',
              reasons: ['50000 VND amount gap', '2 day date gap'],
              remainingAmount: 600000,
              sourceKey: 'payment:payment-review:capture',
              transferRefMatch: false,
              type: 'SETTLEMENT_POSTED',
            },
          ],
          reconciliationMatches: [],
          sourceKey: 'bank:transaction:1',
          status: 'UNMATCHED',
          transferRef: 'BANK-IN-001',
          type: 'INFLOW',
          updatedAt: '2026-06-20T10:05:00.000Z',
          valueDate: '2026-06-20T00:00:00.000Z',
        };
      }
      return fallback;
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/booking-payment-clearing?range=30d&take=50&review=open',
      [],
    );
    expect(markup).toContain('Manual reconciliation match');
    expect(markup).toContain('finance-reconciliation-match-board');
    expect(markup).toContain('Payment clearing match');
    expect(markup).toContain('1 recommended · 1 manual review · 2 shown');
    expect(markup).toContain('Payment clearing candidate');
    expect(markup).toContain('Review evidence and match');
    expect(markup).toContain('Pending journal evidence');
    expect(markup).toContain('Reference match - Demo Customer - 650.000 VND - booking');
    expect(markup).toContain('Select a payment clearing candidate');
    expect(markup).toContain('type="hidden" name="sourceType" value="payment-clearing"');
    expect(markup).toContain('name="sourceId"');
    expect(markup).toContain('Review payment clearing match');
    expect(markup).toContain('Confirm clearing match');
    expect(markup).toContain('Suggested amount:');
    expect(markup).toContain('650.000 VND');
    expect(markup).toContain('Review advanced source match');
    expect(markup).toContain('Confirm advanced match');
    expect(markup).not.toContain('This bank transaction is already fully reconciled.');
  });

  it('separates active bank reconciliation evidence from reversed match history', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/bank-transaction-1?candidatePage=1&candidateTake=25') {
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
          paymentClearingCandidates: [
            {
              amount: 650000,
              amountDelta: 0,
              bookingId: 'booking-1',
              bookingStatus: 'OPEN_MATCHING',
              confidence: 'STRONG',
              currency: 'VND',
              customerLabel: 'Demo Customer',
              dateDeltaDays: 0,
              eligible: true,
              exactAmount: true,
              exclusionReasons: [],
              id: 'clearing-1',
              occurredAt: '2026-06-20T09:10:00.000Z',
              paymentMethod: 'CARD',
              paymentProviderRef: 'BANK-IN-001',
              paymentStatus: 'CAPTURED',
              reasons: ['Remaining clearing amount matches exactly'],
              remainingAmount: 650000,
              sourceKey: 'payment:payment-1:capture',
              transferRefMatch: true,
              type: 'CUSTOMER_PAYMENT_CAPTURED',
            },
          ],
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
    expect(markup).toContain('Confirm clearing match');
  });

  it('uses shared badge atoms for finance detail status pills', () => {
    const paymentClearingSource = readFileSync(
      join(process.cwd(), 'app/finance-tax/payment-clearing/[id]/page.tsx'),
      'utf8',
    );
    const bankReconciliationSource = readFileSync(
      join(process.cwd(), 'app/finance-tax/bank-reconciliation/[id]/page.tsx'),
      'utf8',
    );
    const generalLedgerSource = readFileSync(
      join(process.cwd(), 'app/finance-tax/general-ledger/[id]/page.tsx'),
      'utf8',
    );

    expect(paymentClearingSource).toContain('StatusBadge');
    expect(paymentClearingSource).toContain('StatusBadgeFromPillClass');
    expect(paymentClearingSource).not.toContain('PillClassBadge');
    expect(paymentClearingSource).not.toContain('className={`pill ${bankStatusPill(match.status)}`}');

    expect(bankReconciliationSource).toContain('StatusBadge');
    expect(bankReconciliationSource).toContain('StatusBadgeFromPillClass');
    expect(bankReconciliationSource).not.toContain('PillClassBadge');
    expect(bankReconciliationSource).not.toContain('className={`pill ${statusPill(match.status)}`}');
    expect(bankReconciliationSource).not.toContain(
      "className={`pill ${paymentClearingOptions.length > 0 ? 'pill-success' : 'pill-warn'}`}",
    );

    expect(generalLedgerSource).toContain('StatusBadge');
    expect(generalLedgerSource).not.toContain('PillClassBadge');
    expect(generalLedgerSource).not.toContain(
      "className={`pill ${entry.side === 'DEBIT' ? 'pill-info' : 'pill-success'}`}",
    );
  });

  it('uses shared money atoms for payment clearing detail match amounts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/payment-clearing/[id]/page.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(match.amount, match.currency)}</strong>');
    expect(source).not.toContain(
      '<div className="muted">Bank {formatMoney(match.bankTransaction.amount, match.bankTransaction.currency)}</div>',
    );
  });

  it('uses shared money atoms for bank reconciliation detail match amounts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/bank-reconciliation/[id]/page.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(match.amount, match.currency)}</strong>');
  });

  it('uses shared money atoms for general ledger detail entry amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/general-ledger/[id]/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(entry.amount, entry.currency)}</strong>');
  });

  it.each([
    [
      'booking settlement audit detail',
      'app/finance-tax/booking-settlement-audit/[id]/page.tsx',
      [
        'formatDateTime(snapshot.postedAt)',
        'formatDateTime(snapshot.closedAt)',
        'formatDateTime(reversal.occurredAt)',
      ],
    ],
    [
      'payment clearing detail',
      'app/finance-tax/payment-clearing/[id]/page.tsx',
      [
        'formatDateTime(entry.occurredAt)',
        'formatDateTime(entry.clearedAt)',
        'formatDateTime(match.matchedAt)',
      ],
    ],
    [
      'general ledger detail',
      'app/finance-tax/general-ledger/[id]/page.tsx',
      ['formatDateTime(batch.postedAt)', 'formatDateTime(entry.createdAt)'],
    ],
    [
      'bank reconciliation detail',
      'app/finance-tax/bank-reconciliation/[id]/page.tsx',
      [
        'formatDateTime(transaction.occurredAt)',
        'formatDateTime(transaction.valueDate)',
        'formatDateTime(match.matchedAt)',
      ],
    ],
    [
      'settlement reversal detail',
      'app/finance-tax/settlement-reversals/[id]/page.tsx',
      ['formatDateTime(reversal.occurredAt)', 'formatDateTime(originalSettlement.postedAt)'],
    ],
  ] as const)(
    'uses shared date time atoms for %s visible date values',
    (_name, sourcePath, directFormatCalls) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

      expect(source).toContain('DateTimeText');
      for (const directFormatCall of directFormatCalls) {
        expect(source).not.toContain(directFormatCall);
      }
    },
  );

  it('uses the shared Vuexy detail grid shell for finance detail facts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-detail-info-item.tsx'), 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<div className="detail-grid admin-mt-16">');
  });

  it.each([
    ['booking settlement audit detail', 'app/finance-tax/booking-settlement-audit/[id]/page.tsx'],
    ['payment clearing detail', 'app/finance-tax/payment-clearing/[id]/page.tsx'],
    ['general ledger detail', 'app/finance-tax/general-ledger/[id]/page.tsx'],
    ['bank reconciliation detail', 'app/finance-tax/bank-reconciliation/[id]/page.tsx'],
    ['settlement reversal detail', 'app/finance-tax/settlement-reversals/[id]/page.tsx'],
  ] as const)('uses shared AdminFormControlLink actions for %s', (_name, sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('className="button button-secondary"');
  });

  it('uses shared inline fallback atoms for payment clearing detail missing evidence labels', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/payment-clearing/[id]/page.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('<span className="muted">No payment record</span>');
    expect(source).not.toContain('<span className="muted">-</span>');
    expect(source).not.toContain('<div className="muted">{match.bankTransaction?.type ?? \'-\'}</div>');
    expect(source).not.toContain(
      '<div className="muted">{match.accountingJournalEntry?.accountName ?? \'No journal link\'}</div>',
    );
    expect(source).not.toContain("<td>{match.bankTransaction?.counterpartyName ?? '-'}</td>");
  });

  it('uses shared inline fallback atoms for bank reconciliation detail missing match cells', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/bank-reconciliation/[id]/page.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('return <span className="muted">-</span>;');
  });

  it.each([
    ['payment clearing detail', 'app/finance-tax/payment-clearing/[id]/page.tsx'],
    ['general ledger detail', 'app/finance-tax/general-ledger/[id]/page.tsx'],
    ['bank reconciliation detail', 'app/finance-tax/bank-reconciliation/[id]/page.tsx'],
    ['settlement reversal detail', 'app/finance-tax/settlement-reversals/[id]/page.tsx'],
  ] as const)('uses the shared FinanceDataTable shell for %s', (_name, sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('FinanceDataTable');
    expect(source).not.toContain('AdminTableScroll');
    expect(source).not.toContain('className="vuexy-booking-table"');
  });

  it.each([
    ['payment clearing detail', 'app/finance-tax/payment-clearing/[id]/page.tsx'],
    ['general ledger detail', 'app/finance-tax/general-ledger/[id]/page.tsx'],
    ['bank reconciliation detail', 'app/finance-tax/bank-reconciliation/[id]/page.tsx'],
    ['bank match evidence helper', 'app/finance-tax/finance-bank-match-evidence.tsx'],
  ] as const)('uses the shared table substack atom for %s dense cells', (_name, sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('AdminTableSubstack');
    expect(source).not.toContain('<div className="admin-table-substack"');
    expect(source).not.toContain("className = 'admin-table-substack'");
  });
});
