import type { StatusBadgeTone } from '../../components/status-badge';

export function financePaymentClearingStatusPill(status: string) {
  if (status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

export function financePaymentClearingStatusTone(status: string): StatusBadgeTone {
  if (status === 'CLEARED') {
    return 'success';
  }
  if (status === 'PARTIALLY_CLEARED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

export function financeBankReconciliationStatusPill(status: string) {
  if (status === 'MATCHED' || status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_MATCHED' || status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

export function financeBankReconciliationStatusTone(status: string): StatusBadgeTone {
  if (status === 'MATCHED' || status === 'CLEARED') {
    return 'success';
  }
  if (status === 'PARTIALLY_MATCHED' || status === 'PARTIALLY_CLEARED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

export function financeJournalBatchStatusPill(status: string) {
  if (status === 'POSTED') {
    return 'pill-success';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

export function financeJournalBatchStatusTone(status: string): StatusBadgeTone {
  if (status === 'POSTED') {
    return 'success';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

export function financeMonthlyTaxClosingStatusPill(status: string) {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'pill-success';
  }
  if (status === 'DECLARED' || status === 'REVIEWED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

export function financeMonthlyTaxClosingStatusTone(status: string): StatusBadgeTone {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'success';
  }
  if (status === 'DECLARED' || status === 'REVIEWED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

export function financeTaxCloseoutStatusPill(status: string) {
  return financeMonthlyTaxClosingStatusPill(status);
}

export function financeTaxCloseoutStatusTone(status: string): StatusBadgeTone {
  return financeMonthlyTaxClosingStatusTone(status);
}

export function financeSettlementReversalTaxStatusPill(status: string) {
  return status === 'REVERSED' ? 'pill-danger' : 'pill-warn';
}

export function financeEvidenceTonePill(tone: 'danger' | 'neutral' | 'success' | 'warning') {
  if (tone === 'success') {
    return 'pill-success';
  }
  if (tone === 'danger') {
    return 'pill-danger';
  }
  if (tone === 'warning') {
    return 'pill-warn';
  }
  return 'pill-neutral';
}
