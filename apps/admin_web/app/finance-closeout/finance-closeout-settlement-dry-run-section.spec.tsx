import { renderToStaticMarkup } from 'react-dom/server';

import type {
  AdminBookingSettlementDryRunCounts,
  AdminBookingSettlementDryRunTotals,
  AdminBookingSettlementGapDryRun,
} from '../../lib/admin-api';
import {
  FinanceCloseoutSettlementDryRunSection,
  financeCloseoutPeriodStatusLabel,
} from './finance-closeout-settlement-dry-run-section';

describe('FinanceCloseoutSettlementDryRunSection', () => {
  it('maps known monthly-close states and humanizes an unknown fallback', () => {
    expect(financeCloseoutPeriodStatusLabel('OPEN_OR_UNLINKED')).toBe('Open or not linked');
    expect(financeCloseoutPeriodStatusLabel('REVIEWED')).toBe('Reviewed');
    expect(financeCloseoutPeriodStatusLabel('ARCHIVED_PENDING')).toBe('Archived Pending');
  });

  it('renders unavailable expected accounting without presenting zero-VND totals or success badges', () => {
    const markup = renderReport(expectedAccountingReport('UNAVAILABLE', 0, 2));

    expect(markup).toContain('Unavailable · 0 of 2 computable');
    expect(markup).toContain('Expected journal amounts unavailable for 2 record(s).');
    expect(markup).toContain('Expected batch flow amounts unavailable for 2 record(s).');
    expect(markup).toContain('No unavailable amount is represented as 0 VND.');
    expect(markup).not.toContain('money-text');
    expect(markup).not.toContain('0 VND</span>');
    expect(markup).not.toContain('0 balanced · 0 delta review');
  });

  it('labels partial totals with explicit computable coverage', () => {
    const markup = renderReport(expectedAccountingReport('PARTIAL', 1, 2));

    expect(markup).toContain('Partial · 1 of 2 computable');
    expect(markup).toContain('Partial total ·');
    expect(markup).toContain('1 of 2 record(s) are computable; 1 unavailable record(s) are excluded');
    expect(markup).toContain('money-text');
  });

  it('keeps a computed true zero visible when every expected value is available', () => {
    const markup = renderReport(expectedAccountingReport('ALL_AVAILABLE', 1, 1));

    expect(markup).toContain('1 balanced · 0 delta review');
    expect(markup).toContain('0 VND');
    expect(markup).not.toContain('Unavailable ·');
    expect(markup).not.toContain('Partial total ·');
  });
});

function renderReport(report: AdminBookingSettlementGapDryRun) {
  return renderToStaticMarkup(
    <FinanceCloseoutSettlementDryRunSection
      clearHref="/finance-closeout"
      hrefForBatch={() => '/finance-closeout?reviewBookingId=gap-1'}
      report={report}
      runHref="/finance-closeout?settlementDryRun=1"
    />,
  );
}

function expectedAccountingReport(
  availability: AdminBookingSettlementDryRunTotals['availability'],
  computedCount: number,
  totalCount: number,
): AdminBookingSettlementGapDryRun {
  const counts: AdminBookingSettlementDryRunCounts = {
    blocked: totalCount - computedCount,
    companyOutputVatPositive: 0,
    companyOutputVatZero: computedCount,
    eligible: computedCount,
    expectedAvailable: computedCount,
    expectedUnavailable: totalCount - computedCount,
    journalBalanced: computedCount,
    paymentFeeDefaulted: 0,
    paymentFeePolicyMatched: computedCount,
    platformVatEvidenceReady: computedCount,
    platformVatExplicitZeroServiceRule: computedCount,
    platformVatUnexplainedZero: 0,
    platformVatZeroFromPolicy: 0,
    reconciliationReview: 0,
    reviewRequired: 0,
  };
  const totals: AdminBookingSettlementDryRunTotals = {
    availability,
    companyOutputVat: 0,
    computedCount,
    customerPaymentAmount: 0,
    journalReconciliationDelta: 0,
    journalTotalCredit: 0,
    journalTotalDebit: 0,
    partnerPayoutAmount: 0,
    partnerWithholdingTotal: 0,
    paymentProcessingFee: 0,
    platformFeeGross: 0,
    platformFeeNetRevenue: 0,
    totalCount,
  };

  return {
    blockerCodes: totalCount > computedCount ? { HISTORICAL_DRY_RUN_UNAVAILABLE: totalCount - computedCount } : {},
    counts,
    evaluated: totalCount,
    generatedAt: '2026-08-25T00:00:00.000Z',
    items: [],
    paymentMethods: { CASH: totalCount },
    policyGate: {
      issues: [],
      status: totalCount > computedCount ? 'REVIEW_REQUIRED' : 'READY_FOR_INDIVIDUAL_APPROVAL',
    },
    periodStatuses: { OPEN: totalCount },
    recoveryBatches: [
      {
        batchKey: 'cash-1',
        bookingIds: ['gap-1'],
        counts,
        executionStatus: totalCount > computedCount ? 'REVIEW_REQUIRED' : 'READY_FOR_INDIVIDUAL_APPROVAL',
        paymentMethod: 'CASH',
        recordCount: totalCount,
        totals,
      },
    ],
    totalMatched: totalCount,
    totals,
    truncated: false,
  };
}
