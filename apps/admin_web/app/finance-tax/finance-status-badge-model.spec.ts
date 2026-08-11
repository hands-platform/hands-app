import {
  financeBankReconciliationStatusModel,
  financeBankReconciliationStatusPill,
  financeBankReconciliationStatusTone,
  financeEvidenceTonePill,
  financeJournalBatchStatusPill,
  financeJournalBatchStatusTone,
  financeMonthlyTaxClosingStatusPill,
  financeMonthlyTaxClosingStatusTone,
  financePaymentClearingStatusPill,
  financePaymentClearingStatusTone,
  financeSettlementReversalTaxStatusPill,
  financeTaxCloseoutStatusPill,
  financeTaxCloseoutStatusTone,
} from './finance-status-badge-model';

describe('finance status badge model', () => {
  it('maps payment clearing statuses to shared badge classes and panel tones', () => {
    expect(financePaymentClearingStatusPill('CLEARED')).toBe('pill-success');
    expect(financePaymentClearingStatusPill('PARTIALLY_CLEARED')).toBe('pill-info');
    expect(financePaymentClearingStatusPill('REVERSED')).toBe('pill-danger');
    expect(financePaymentClearingStatusPill('OPEN')).toBe('pill-warn');

    expect(financePaymentClearingStatusTone('CLEARED')).toBe('success');
    expect(financePaymentClearingStatusTone('PARTIALLY_CLEARED')).toBe('info');
    expect(financePaymentClearingStatusTone('REVERSED')).toBe('danger');
    expect(financePaymentClearingStatusTone('OPEN')).toBe('warning');
  });

  it('maps bank reconciliation statuses consistently across list and detail pages', () => {
    expect(financeBankReconciliationStatusPill('MATCHED')).toBe('pill-success');
    expect(financeBankReconciliationStatusPill('CLEARED')).toBe('pill-success');
    expect(financeBankReconciliationStatusPill('PARTIALLY_MATCHED')).toBe('pill-info');
    expect(financeBankReconciliationStatusPill('PARTIALLY_CLEARED')).toBe('pill-info');
    expect(financeBankReconciliationStatusPill('REVERSED')).toBe('pill-danger');
    expect(financeBankReconciliationStatusPill('UNMATCHED')).toBe('pill-warn');

    expect(financeBankReconciliationStatusTone('MATCHED')).toBe('success');
    expect(financeBankReconciliationStatusTone('PARTIALLY_MATCHED')).toBe('info');
    expect(financeBankReconciliationStatusTone('REVERSED')).toBe('danger');
    expect(financeBankReconciliationStatusTone('UNMATCHED')).toBe('warning');
  });

  it('keeps ignored and reversed reconciliation records closed without exposing match actions', () => {
    expect(financeBankReconciliationStatusModel('IGNORED')).toEqual({
      closed: true,
      closeoutLabel: 'Closed - no matching required',
      label: 'Ignored',
      nextAction: 'No action required',
    });
    expect(financeBankReconciliationStatusModel('REVERSED')).toEqual({
      closed: true,
      closeoutLabel: 'Closed - reversed evidence',
      label: 'Reversed',
      nextAction: 'Review audit history',
    });
    expect(financeBankReconciliationStatusModel('PARTIALLY_MATCHED')).toMatchObject({
      closed: false,
      nextAction: 'Match remaining amount',
    });
  });

  it('maps journal, monthly close, reversal, and evidence tones', () => {
    expect(financeJournalBatchStatusPill('POSTED')).toBe('pill-success');
    expect(financeJournalBatchStatusPill('REVERSED')).toBe('pill-danger');
    expect(financeJournalBatchStatusPill('DRAFT')).toBe('pill-warn');
    expect(financeJournalBatchStatusTone('POSTED')).toBe('success');
    expect(financeJournalBatchStatusTone('REVERSED')).toBe('danger');
    expect(financeJournalBatchStatusTone('DRAFT')).toBe('warning');

    expect(financeMonthlyTaxClosingStatusPill('PAID')).toBe('pill-success');
    expect(financeMonthlyTaxClosingStatusPill('CLOSED')).toBe('pill-success');
    expect(financeMonthlyTaxClosingStatusPill('DECLARED')).toBe('pill-info');
    expect(financeMonthlyTaxClosingStatusPill('REVERSED')).toBe('pill-danger');
    expect(financeMonthlyTaxClosingStatusPill('DRAFT')).toBe('pill-warn');
    expect(financeMonthlyTaxClosingStatusTone('REVIEWED')).toBe('info');
    expect(financeMonthlyTaxClosingStatusTone('DRAFT')).toBe('warning');
    expect(financeTaxCloseoutStatusPill('PAID')).toBe('pill-success');
    expect(financeTaxCloseoutStatusPill('DECLARED')).toBe('pill-info');
    expect(financeTaxCloseoutStatusPill('REVERSED')).toBe('pill-danger');
    expect(financeTaxCloseoutStatusTone('CLOSED')).toBe('success');
    expect(financeTaxCloseoutStatusTone('OPEN')).toBe('warning');

    expect(financeSettlementReversalTaxStatusPill('REVERSED')).toBe('pill-danger');
    expect(financeSettlementReversalTaxStatusPill('OPEN')).toBe('pill-warn');
    expect(financeEvidenceTonePill('success')).toBe('pill-success');
    expect(financeEvidenceTonePill('danger')).toBe('pill-danger');
    expect(financeEvidenceTonePill('warning')).toBe('pill-warn');
    expect(financeEvidenceTonePill('neutral')).toBe('pill-neutral');
  });
});
