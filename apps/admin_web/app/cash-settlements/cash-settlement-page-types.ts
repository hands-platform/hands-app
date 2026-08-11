import type { AdminEarning } from '../../lib/admin-api';
import type { AdminDateRange } from '../../lib/date-range';
import type {
  AdminQueueAge,
  AdminQueueSlaFilter,
} from '../../lib/admin-queue-list';

export type CashSettlementRow = {
  earning: AdminEarning;
  providerName: string;
  providerPhone: string;
  paymentMethod: string;
  originalDebtAmount: number;
  allocatedAmount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  settlementEvidence: string;
  serviceLabel: string;
  createdAtLabel: string;
};

export type CashSettlementSummary = {
  providerCount: number;
  rowCount: number;
  companyCouponOffset: number;
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

export type CashSettlementQueueFilter =
  | 'all'
  | 'stale'
  | 'high-debt'
  | 'missing-evidence'
  | 'payment-check';
export type CashSettlementSort = 'highest-debt' | 'newest' | 'oldest';
export type CashSettlementView = 'guide' | null;

export type CashSettlementFilters = {
  age: AdminQueueAge;
  page: number;
  pageSize: number;
  period: string | null;
  range: AdminDateRange;
  returnTo: string | null;
  queue: CashSettlementQueueFilter;
  q: string;
  sla: AdminQueueSlaFilter;
  sort: CashSettlementSort;
  view: CashSettlementView;
};

export type CashSettlementPagination<T> = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export const cashSettlementQueueOptions: Array<{ value: CashSettlementQueueFilter; label: string }> = [
  { value: 'all', label: 'All open' },
  { value: 'stale', label: 'Overdue' },
  { value: 'missing-evidence', label: 'Missing evidence' },
  { value: 'high-debt', label: 'High exposure' },
  { value: 'payment-check', label: 'Payment check' },
];
