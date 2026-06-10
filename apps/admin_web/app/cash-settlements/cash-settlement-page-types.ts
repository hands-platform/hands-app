import type { AdminEarning } from '../../lib/admin-api';
import type { AdminDateRange } from '../../lib/date-range';

export type CashSettlementRow = {
  earning: AdminEarning;
  providerName: string;
  providerPhone: string;
  paymentMethod: string;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  bookingAmount: number;
  settlementReference: string;
  lastLedgerRef?: string | null;
  debtOrigin: string;
  settlementEvidence: string;
  serviceLabel: string;
  createdAtLabel: string;
  nextAction: string;
};

export type CashSettlementProviderGroup = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  settlementReference: string;
  oldestOpenMs: number;
  oldestOpenLabel: string;
};

export type CommandCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

export type CashSettlementPriorityItem = {
  row: CashSettlementRow;
  priority: string;
  pillClass: string;
  ageLabel: string;
  reason: string;
  requiredEvidence: string[];
  unlockResult: string[];
};

export type AppliedCashSettlementPolicyCard = {
  label: string;
  value: string;
  helper: string;
};

export type EvidenceChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: string;
  pillClass: string;
};

export type CashSettlementHandoffItem = EvidenceChecklistItem;

export type WalletRecoveryStep = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  pillClass: string;
};

export type CashSettlementSummary = {
  providerCount: number;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  currency: string;
  oldestOpenLabel: string;
  staleDebtRowCount: number;
  highDebtProviderCount: number;
  missingPaymentEvidenceCount: number;
  cashPaymentRowCount: number;
};

export type CashSettlementQueueFilter = 'all' | 'stale' | 'high-debt' | 'missing-ref' | 'payment-check';

export type CashSettlementFilters = {
  range: AdminDateRange;
  queue: CashSettlementQueueFilter;
  q: string;
};

export const cashSettlementQueueOptions: Array<{ value: CashSettlementQueueFilter; label: string }> = [
  { value: 'all', label: 'All open debt' },
  { value: 'stale', label: 'Over 24h' },
  { value: 'high-debt', label: 'High debt' },
  { value: 'missing-ref', label: 'No recorded ref' },
  { value: 'payment-check', label: 'Payment check' },
];
