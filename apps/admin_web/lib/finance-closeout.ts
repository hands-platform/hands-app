import type {
  AdminBookingSettlementGapList,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPaymentMethod,
  AdminPaymentSummary,
  AdminPayoutBatch,
  AdminRefund,
  AdminRefundSummary,
} from './admin-api';
import { formatMoney } from './admin-format';
import type { AdminDateRange } from './date-range';
import { dateRangeLabel, normalizeDateRange, readSearchParam } from './date-range';

export type FinanceCloseoutTask = {
  readonly action: string;
  readonly className: string;
  readonly detail: string;
  readonly href: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

export type FinanceCloseoutEvidenceChecklistItem = {
  readonly className: string;
  readonly detail: string;
  readonly href: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

export type FinanceCloseoutShiftActionMapItem = {
  readonly action: string;
  readonly href: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

export type FinanceCloseoutHandoffRow = {
  readonly amount: string;
  readonly count: number;
  readonly href: string;
  readonly label: string;
  readonly nextAction: string;
};

export type ReconciliationInput = {
  readonly cashSummary: AdminCashSettlementSummary | null;
  readonly currency: string;
  readonly earnings: readonly AdminEarning[];
  readonly earningsSummary: AdminEarningSummary;
  readonly paymentSummary?: AdminPaymentSummary | null;
  readonly payments: readonly AdminPayment[];
  readonly payouts: readonly AdminPayoutBatch[];
  readonly range: AdminDateRange;
  readonly refundSummary?: AdminRefundSummary | null;
  readonly refunds: readonly AdminRefund[];
};

const OPEN_PAYMENT_REFERENCE_STATUSES = ['AUTHORIZED', 'PENDING'];
const CLOSED_PAYOUT_STATUSES = ['PAID', 'CANCELLED'];
const PAYOUT_REFERENCE_REQUIRED_STATUSES = ['PROCESSING', 'PAID'];
const FINANCE_CLOSEOUT_API_LIMIT = 10;
const FINANCE_CLOSEOUT_SETTLEMENT_PAGE_SIZE = 10;

export type FinanceCloseoutWorkspace = 'operations' | 'settlement';
export type FinanceCloseoutSettlementMode = 'queue' | 'batch';
export type FinanceCloseoutSettlementAge = 'backlog' | '24-72h' | '3-7d' | '7d-plus' | 'recent' | 'all';
export type FinanceCloseoutSettlementTrack =
  | 'canonical'
  | 'historical-ready'
  | 'evidence-blocked'
  | 'manual-review'
  | 'all';
export type FinanceCloseoutSettlementPaymentMethod = AdminPaymentMethod | 'all';

export const FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS: ReadonlyArray<{
  label: string;
  value: FinanceCloseoutSettlementAge;
}> = [
  { label: 'Backlog', value: 'backlog' },
  { label: '24–72 hours', value: '24-72h' },
  { label: '3–7 days', value: '3-7d' },
  { label: '7+ days', value: '7d-plus' },
  { label: 'Under 24 hours', value: 'recent' },
  { label: 'All gaps', value: 'all' },
];

export const FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS: ReadonlyArray<{
  label: string;
  value: FinanceCloseoutSettlementTrack;
}> = [
  { label: 'Canonical', value: 'canonical' },
  { label: 'Historical policy review', value: 'historical-ready' },
  { label: 'Evidence blocked', value: 'evidence-blocked' },
  { label: 'Manual review', value: 'manual-review' },
  { label: 'All repair tracks', value: 'all' },
];

export const FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  label: string;
  value: FinanceCloseoutSettlementPaymentMethod;
}> = [
  { label: 'All payment methods', value: 'all' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'MoMo', value: 'MOMO' },
  { label: 'VNPay', value: 'VNPAY' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Customer wallet', value: 'CUSTOMER_WALLET' },
  { label: 'Manual', value: 'MANUAL' },
];

export function buildFinanceCloseoutSettlementPeriodOptions(now = new Date()) {
  const vietnamParts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(now);
  const year = Number(vietnamParts.find((part) => part.type === 'year')?.value ?? now.getUTCFullYear());
  const month = Number(vietnamParts.find((part) => part.type === 'month')?.value ?? now.getUTCMonth() + 1);
  return [
    { label: 'All settlement months', value: 'all' },
    ...Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1 - index, 1));
      return {
        label: new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC', year: 'numeric' }).format(
          date,
        ),
        value: date.toISOString().slice(0, 7),
      };
    }),
  ];
}

export function buildReconciliation(input: ReconciliationInput) {
  const authorizedPayments = input.payments.filter((payment) => payment.status === 'AUTHORIZED');
  const cashPending = input.payments.filter(
    (payment) => payment.method === 'CASH' && payment.status === 'PENDING',
  );
  const missingPaymentRefs = input.payments.filter(paymentNeedsReference);
  const openRefunds = input.refunds.filter(refundNeedsCloseout);
  const openPayouts = input.payouts.filter(payoutNeedsCloseout);
  const payoutMissingRefs = input.payouts.filter(payoutNeedsReference);
  const earningsWithoutTaxLogs = input.earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const authorizedPaymentCount = input.paymentSummary?.authorized ?? authorizedPayments.length;
  const cashPendingCount = input.paymentSummary?.pendingCash ?? cashPending.length;
  const openRefundCount = input.refundSummary?.openCount ?? openRefunds.length;
  const rangedCashDebtAmount = input.earnings
    .filter((earning) => earning.netAmount < 0 && earning.status !== 'PAID')
    .reduce((sum, earning) => sum + Math.abs(earning.netAmount), 0);

  return {
    authorizedPayments,
    cashPending,
    missingPaymentRefs,
    openRefunds,
    openPayouts,
    payoutMissingRefs,
    earningsWithoutTaxLogs,
    authorizedPaymentCount,
    cashPendingCount,
    openPaymentCount: authorizedPaymentCount + cashPendingCount,
    openRefundCount,
    openPayoutCount: openPayouts.length,
    cashDebtAmount:
      input.range === 'all'
        ? (input.cashSummary?.totalDebtAmount ?? Math.abs(Math.min(0, input.earningsSummary.netAmount)))
        : rangedCashDebtAmount,
    missingReferenceCount: missingPaymentRefs.length + payoutMissingRefs.length,
    currency: input.currency,
  };
}

type FinanceCloseoutReconciliation = ReturnType<typeof buildReconciliation>;

export function buildCloseoutTasks(reconciliation: FinanceCloseoutReconciliation): FinanceCloseoutTask[] {
  return [
    {
      title: 'Payment hold review',
      status: `${reconciliation.authorizedPaymentCount} HOLD(S)`,
      detail:
        'Authorized payments should remain held until service completion, then capture, release, or refund.',
      action: reconciliation.authorizedPaymentCount ? 'Open payment holds before handoff.' : 'No open holds.',
      href: '/payments?review=authorized',
      className: reconciliation.authorizedPaymentCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.authorizedPaymentCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Cash collection review',
      status: `${reconciliation.cashPendingCount} CASH`,
      detail:
        'Cash bookings need confirmation that the Partner collected customer cash and the wallet debt is recorded.',
      action: reconciliation.cashPendingCount
        ? 'Confirm cash rows and wallet impact.'
        : 'No pending cash collection.',
      href: '/payments?review=cash',
      className: reconciliation.cashPendingCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.cashPendingCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Refund queue',
      status: `${reconciliation.openRefundCount} OPEN`,
      detail: 'Refund cases need payment ledger state, customer message, and booking closeout alignment.',
      action: reconciliation.openRefundCount ? 'Resolve requested refunds.' : 'No open refund cases.',
      href: '/refunds?review=open',
      className: reconciliation.openRefundCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliation.openRefundCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Missing references',
      status: `${reconciliation.missingReferenceCount} CHECK`,
      detail: 'Gateway and transfer references are required for auditable finance handoff.',
      action: reconciliation.missingReferenceCount
        ? 'Fill missing payment or payout references.'
        : 'References look complete.',
      href: '/payments?review=missing-ref',
      className: reconciliation.missingReferenceCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.missingReferenceCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payout release review',
      status: `${reconciliation.openPayouts.length} BATCH(ES)`,
      detail:
        'Open payout batches should be checked against earnings, tax logs, transfer refs, and active holds.',
      action: reconciliation.openPayouts.length
        ? 'Review payout blockers before bank transfer.'
        : 'No open payout batch.',
      href: '/payouts',
      className: reconciliation.openPayouts.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.openPayouts.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Tax log coverage',
      status: `${reconciliation.earningsWithoutTaxLogs.length} ROW(S)`,
      detail:
        'Completed earnings should carry a tax snapshot so later policy changes do not rewrite history.',
      action: reconciliation.earningsWithoutTaxLogs.length
        ? 'Check earnings without tax logs.'
        : 'Tax snapshots are present.',
      href: '/earnings',
      className: reconciliation.earningsWithoutTaxLogs.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.earningsWithoutTaxLogs.length ? 'pill-warn' : 'pill-success',
    },
  ];
}

export function buildFinanceCloseoutEvidenceChecklist(
  reconciliation: FinanceCloseoutReconciliation,
): FinanceCloseoutEvidenceChecklistItem[] {
  const openPayments = reconciliation.openPaymentCount;
  const referencesComplete = reconciliation.missingReferenceCount === 0;

  return [
    {
      title: 'Payment state',
      status: `${openPayments} open`,
      detail: 'Holds, cash pending rows, captures, releases, and refunds must match booking outcomes.',
      operatorRule: 'Do not close the shift while an unexplained payment state remains open.',
      href: '/payments',
      className: openPayments ? 'ops-task-pending' : 'ops-task-done',
      pillClass: openPayments ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Refund queue',
      status: `${reconciliation.openRefundCount} open`,
      detail: 'Open refund rows need customer update, payment ledger alignment, and booking evidence.',
      operatorRule: 'Refund outcomes should be closed before finance handoff whenever possible.',
      href: '/refunds?review=open',
      className: reconciliation.openRefundCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliation.openRefundCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Cash debt',
      status: formatMoney(reconciliation.cashDebtAmount, reconciliation.currency),
      detail: 'Cash collected by a Partner must leave company-fee deposit or approved offset evidence.',
      operatorRule: 'Negative wallet rows remain visible until settlement evidence is recorded.',
      href: '/cash-settlements',
      className: reconciliation.cashDebtAmount > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.cashDebtAmount > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Batch payout release',
      status: `${reconciliation.openPayouts.length} batch(es)`,
      detail: 'Payout release should run as weekly, monthly, or admin-date batch with transfer references.',
      operatorRule: referencesComplete
        ? 'References look complete for visible records.'
        : 'Fill missing payment or payout references before release.',
      href: '/payouts',
      className: referencesComplete ? 'ops-task-done' : 'ops-task-pending',
      pillClass: referencesComplete ? 'pill-success' : 'pill-warn',
    },
  ];
}

export function buildShiftCloseActionMap(
  reconciliation: FinanceCloseoutReconciliation,
): FinanceCloseoutShiftActionMapItem[] {
  const openPayments = reconciliation.openPaymentCount;
  const openRefunds = reconciliation.openRefundCount;
  const cashDebt = reconciliation.cashDebtAmount;
  const openPayouts = reconciliation.openPayouts.length;
  const missingRefs = reconciliation.missingReferenceCount;
  const taxRows = reconciliation.earningsWithoutTaxLogs.length;
  const allClear =
    openPayments === 0 &&
    openRefunds === 0 &&
    cashDebt <= 0 &&
    openPayouts === 0 &&
    missingRefs === 0 &&
    taxRows === 0;

  return [
    {
      action: 'Payment close',
      status: openPayments ? `${openPayments} open` : 'Clear',
      reason: openPayments
        ? `${reconciliation.authorizedPaymentCount} authorization hold(s), ${reconciliation.cashPendingCount} cash pending row(s).`
        : 'No open payment hold or pending cash collection is visible.',
      operatorRule: 'Capture, release, refund, or record cash settlement evidence before shift handoff.',
      href: '/payments?review=needs-action',
      pillClass: openPayments ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Refund close',
      status: openRefunds ? `${openRefunds} open` : 'Clear',
      reason: openRefunds
        ? 'Refund rows still need payment, booking, and customer message alignment.'
        : 'No open refund row is visible.',
      operatorRule:
        'Refund closeout requires booking, payment, customer message, and admin evidence alignment.',
      href: '/refunds?review=open',
      pillClass: openRefunds ? 'pill-danger' : 'pill-success',
    },
    {
      action: 'Cash debt close',
      status: cashDebt > 0 ? formatMoney(cashDebt, reconciliation.currency) : 'Clear',
      reason:
        cashDebt > 0 ? 'Partner cash collection debt remains open.' : 'No open cash wallet debt is visible.',
      operatorRule: 'Keep cash debt rows visible until deposit reference or approved offset is recorded.',
      href: '/cash-settlements',
      pillClass: cashDebt > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Payout release close',
      status: openPayouts ? `${openPayouts} batch(es)` : 'Clear',
      reason: openPayouts
        ? 'Open payout batches still need transfer reference, earning trace, or blocker review.'
        : 'No open payout batch is visible.',
      operatorRule: 'Paid status requires bank reference, earning trace, tax logs, and no payout blocker.',
      href: '/payouts',
      pillClass: openPayouts ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Reference and tax trace',
      status: missingRefs || taxRows ? `${missingRefs + taxRows} check(s)` : 'Clear',
      reason:
        missingRefs || taxRows
          ? `${missingRefs} missing reference(s), ${taxRows} earning row(s) without tax log.`
          : 'References and tax traces look complete for visible records.',
      operatorRule: 'Shift closeout keeps historical tax and bank references stable for later audit.',
      href: '/audit-log?bucket=Finance%2FCloseout',
      pillClass: missingRefs || taxRows ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Handoff note',
      status: allClear ? 'Ready' : 'Needs note',
      reason: allClear
        ? 'Finance queues are ready for clean handoff.'
        : 'Leave a handoff note for open finance queues.',
      operatorRule: 'The handoff should be factual: queue, amount, record link, and next operator action.',
      href: '/operations-handoff',
      pillClass: allClear ? 'pill-success' : 'pill-info',
    },
  ];
}

export function buildHandoffRows(reconciliation: FinanceCloseoutReconciliation): FinanceCloseoutHandoffRow[] {
  return [
    {
      label: 'Payment holds',
      count: reconciliation.authorizedPaymentCount,
      amount: formatMoney(
        reconciliation.authorizedPayments.reduce((sum, payment) => sum + payment.amount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Capture after service completion or release/refund if the booking fails.',
      href: '/payments?review=authorized',
    },
    {
      label: 'Refunds',
      count: reconciliation.openRefundCount,
      amount: formatMoney(
        reconciliation.openRefunds.reduce((sum, refund) => sum + refund.amount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Keep payment ledger, booking status, and customer message aligned.',
      href: '/refunds?review=open',
    },
    {
      label: 'Cash wallet debt',
      count: reconciliation.cashPendingCount,
      amount: formatMoney(reconciliation.cashDebtAmount, reconciliation.currency),
      nextAction:
        'Collect Partner deposit or approve documented offset before final acceptance, service start, or payout release.',
      href: '/cash-settlements',
    },
    {
      label: 'Payout batches',
      count: reconciliation.openPayouts.length,
      amount: formatMoney(
        reconciliation.openPayouts.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Verify transfer ref, earnings, withholding logs, and Partner account state.',
      href: '/payouts',
    },
  ];
}

export function buildFinanceCloseoutFilters(params: Record<string, string | string[] | undefined>) {
  const rangeParam = readSearchParam(params.range);
  const range = rangeParam ? normalizeDateRange(rangeParam) : 'today';
  const requestedWorkspace = readSearchParam(params.view);
  const requestedSettlementMode = readSearchParam(params.settlementMode);
  const hasSettlementQueueIntent = [
    params.checkpointBookingId,
    params.repairBookingId,
    params.repairNotice,
  ].some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  const hasSettlementBatchIntent = [params.reviewBookingId, params.settlementDryRun].some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  const hasLegacySettlementIntent = [
    params.checkpointBookingId,
    params.q,
    params.repairBookingId,
    params.repairNotice,
    params.reviewBookingId,
    params.settlementAge,
    params.settlementDryRun,
    params.settlementMode,
    params.settlementPage,
    params.settlementPaymentMethod,
    params.settlementPeriod,
    params.settlementTrack,
  ].some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  const workspace: FinanceCloseoutWorkspace =
    requestedWorkspace === 'operations' && !hasLegacySettlementIntent ? 'operations' : 'settlement';
  const settlementMode: FinanceCloseoutSettlementMode = hasSettlementQueueIntent
    ? 'queue'
    : requestedSettlementMode === 'batch' || hasSettlementBatchIntent
      ? 'batch'
      : 'queue';
  const settlementAge = normalizeFinanceCloseoutSettlementAge(readSearchParam(params.settlementAge));
  const settlementPaymentMethod = normalizeFinanceCloseoutSettlementPaymentMethod(
    readSearchParam(params.settlementPaymentMethod),
  );
  const settlementPeriod = normalizeFinanceCloseoutSettlementPeriod(readSearchParam(params.settlementPeriod));
  const settlementTrack = normalizeFinanceCloseoutSettlementTrack(readSearchParam(params.settlementTrack));
  const settlementPage = normalizeFinanceCloseoutPage(readSearchParam(params.settlementPage));
  const settlementQuery = (readSearchParam(params.q) ?? '').trim().slice(0, 80);
  return {
    range,
    label: dateRangeLabel(range),
    settlementAge,
    settlementAgeLabel: financeCloseoutSettlementAgeLabel(settlementAge),
    settlementMode,
    settlementPage,
    settlementPageSize: FINANCE_CLOSEOUT_SETTLEMENT_PAGE_SIZE,
    settlementPaymentMethod,
    settlementPeriod,
    settlementQuery,
    settlementTrack,
    settlementTrackLabel: financeCloseoutSettlementTrackLabel(settlementTrack),
    workspace,
  };
}

export function buildFinanceCloseoutApiHrefs(filters: ReturnType<typeof buildFinanceCloseoutFilters>) {
  const query = new URLSearchParams({
    range: filters.range,
    take: String(FINANCE_CLOSEOUT_API_LIMIT),
  });
  const earningQuery = new URLSearchParams(query);
  earningQuery.set('review', 'closeout-review');
  const paymentQuery = new URLSearchParams(query);
  paymentQuery.set('review', 'needs-action');
  const payoutBatchQuery = new URLSearchParams(query);
  payoutBatchQuery.set('review', 'needs-review');
  const refundQuery = new URLSearchParams(query);
  refundQuery.set('review', 'open');
  const settlementGapQuery = new URLSearchParams({
    age: filters.settlementAge,
    skip: String((filters.settlementPage - 1) * filters.settlementPageSize),
    take: String(filters.settlementPageSize),
    track: filters.settlementTrack,
  });
  if (filters.settlementQuery) {
    settlementGapQuery.set('q', filters.settlementQuery);
  }
  if (filters.settlementPeriod !== 'all') {
    settlementGapQuery.set('period', filters.settlementPeriod);
  }
  if (filters.settlementPaymentMethod !== 'all') {
    settlementGapQuery.set('paymentMethod', filters.settlementPaymentMethod);
  }
  const settlementDryRunQuery = new URLSearchParams({ take: '100' });
  const settlementSummaryQuery = new URLSearchParams();
  if (filters.settlementMode === 'queue') {
    settlementSummaryQuery.set('age', filters.settlementAge);
    settlementSummaryQuery.set('track', filters.settlementTrack);
  }
  if (filters.settlementQuery) {
    settlementSummaryQuery.set('q', filters.settlementQuery);
  }
  if (filters.settlementPeriod !== 'all') {
    settlementDryRunQuery.set('period', filters.settlementPeriod);
    settlementSummaryQuery.set('period', filters.settlementPeriod);
  }
  if (filters.settlementPaymentMethod !== 'all') {
    settlementDryRunQuery.set('paymentMethod', filters.settlementPaymentMethod);
    settlementSummaryQuery.set('paymentMethod', filters.settlementPaymentMethod);
  }

  return {
    bookingSettlementGapDryRunHref: `/admin/booking-settlement-gaps/dry-run?${settlementDryRunQuery.toString()}`,
    bookingSettlementGapSummaryHref: `/admin/booking-settlement-gaps/summary${settlementSummaryQuery.size ? `?${settlementSummaryQuery.toString()}` : ''}`,
    bookingSettlementGapsHref: `/admin/booking-settlement-gaps?${settlementGapQuery.toString()}`,
    cashSettlementSummaryHref: `/admin/cash-settlement-summary?range=${filters.range}`,
    earningsHref: `/admin/earnings?${earningQuery.toString()}`,
    earningsSummaryHref: `/admin/earnings/summary?range=${filters.range}`,
    payoutBatchesHref: `/admin/payout-batches?${payoutBatchQuery.toString()}`,
    paymentsHref: `/admin/payments?${paymentQuery.toString()}`,
    paymentSummaryHref: `/admin/payments/summary?range=${filters.range}`,
    refundsHref: `/admin/refunds?${refundQuery.toString()}`,
    refundSummaryHref: `/admin/refunds/summary?range=${filters.range}`,
  };
}

export function buildFinanceCloseoutPageHref(
  filters: ReturnType<typeof buildFinanceCloseoutFilters>,
  overrides: Partial<{
    range: AdminDateRange;
    settlementAge: FinanceCloseoutSettlementAge;
    settlementMode: FinanceCloseoutSettlementMode;
    settlementPage: number;
    settlementPaymentMethod: FinanceCloseoutSettlementPaymentMethod;
    settlementPeriod: string;
    settlementQuery: string;
    settlementTrack: FinanceCloseoutSettlementTrack;
  }> = {},
) {
  const settlementMode = overrides.settlementMode ?? filters.settlementMode;
  const params = new URLSearchParams({
    range: overrides.range ?? filters.range,
    settlementPaymentMethod: overrides.settlementPaymentMethod ?? filters.settlementPaymentMethod,
    settlementPeriod: overrides.settlementPeriod ?? filters.settlementPeriod,
    view: 'settlement',
  });
  if (settlementMode === 'batch') {
    params.set('settlementMode', 'batch');
  } else {
    params.set('settlementAge', overrides.settlementAge ?? filters.settlementAge);
    params.set('settlementPage', String(overrides.settlementPage ?? filters.settlementPage));
    params.set('settlementTrack', overrides.settlementTrack ?? filters.settlementTrack);
    const query = overrides.settlementQuery ?? filters.settlementQuery;
    if (query) {
      params.set('q', query);
    }
  }
  return `/finance-closeout?${params.toString()}`;
}

export function buildFinanceCloseoutOperationsHref(range: AdminDateRange) {
  return `/finance-overview?range=${range}`;
}

export function buildFinanceCloseoutSettlementRepairHref(
  filters: ReturnType<typeof buildFinanceCloseoutFilters>,
  bookingId: string,
) {
  const url = new URL(
    buildFinanceCloseoutPageHref(filters, { settlementMode: 'queue' }),
    'http://admin.local',
  );
  url.searchParams.set('repairBookingId', bookingId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function buildFinanceCloseoutSettlementDryRunHref(
  filters: ReturnType<typeof buildFinanceCloseoutFilters>,
) {
  const url = new URL(
    buildFinanceCloseoutPageHref(filters, { settlementMode: 'batch' }),
    'http://admin.local',
  );
  url.searchParams.set('settlementDryRun', '1');
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function buildFinanceCloseoutSettlementBatchReviewHref(
  filters: ReturnType<typeof buildFinanceCloseoutFilters>,
  bookingIds: readonly string[],
) {
  const url = new URL(buildFinanceCloseoutSettlementDryRunHref(filters), 'http://admin.local');
  Array.from(new Set(bookingIds.map((bookingId) => bookingId.trim()).filter(Boolean)))
    .slice(0, 10)
    .forEach((bookingId) => url.searchParams.append('reviewBookingId', bookingId));
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function buildFinanceCloseoutSettlementPagination(list: AdminBookingSettlementGapList) {
  const pageSize = Math.max(1, list.take || FINANCE_CLOSEOUT_SETTLEMENT_PAGE_SIZE);
  const totalRows = Math.max(0, list.total);
  const page = Math.floor(Math.max(0, list.skip) / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  return {
    from: totalRows === 0 ? 0 : list.skip + 1,
    page,
    pageSize,
    to: Math.min(list.skip + list.items.length, totalRows),
    totalPages,
    totalRows,
  };
}

export function financeCloseoutSettlementAgeLabel(age: FinanceCloseoutSettlementAge) {
  return FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS.find((option) => option.value === age)?.label ?? 'Backlog';
}

export function financeCloseoutSettlementTrackLabel(track: FinanceCloseoutSettlementTrack) {
  return (
    FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS.find((option) => option.value === track)?.label ?? 'Canonical'
  );
}

function normalizeFinanceCloseoutSettlementTrack(value?: string): FinanceCloseoutSettlementTrack {
  return FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS.some((option) => option.value === value)
    ? (value as FinanceCloseoutSettlementTrack)
    : 'canonical';
}

function normalizeFinanceCloseoutSettlementPaymentMethod(
  value?: string,
): FinanceCloseoutSettlementPaymentMethod {
  return FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS.some((option) => option.value === value)
    ? (value as FinanceCloseoutSettlementPaymentMethod)
    : 'all';
}

function normalizeFinanceCloseoutSettlementPeriod(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : 'all';
}

function normalizeFinanceCloseoutSettlementAge(value?: string): FinanceCloseoutSettlementAge {
  return FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS.some((option) => option.value === value)
    ? (value as FinanceCloseoutSettlementAge)
    : 'backlog';
}

function normalizeFinanceCloseoutPage(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 1000);
}

export function summarizeEarnings(earnings: readonly AdminEarning[], currency: string): AdminEarningSummary {
  return earnings.reduce<AdminEarningSummary>(
    (summary, earning) => {
      summary.count += 1;
      summary.grossAmount += earning.grossAmount;
      summary.platformFee += earning.platformFee;
      summary.withholdingAmount += earning.withholdingAmount;
      summary.netAmount += earning.netAmount;
      if (earning.status === 'PENDING') {
        summary.pendingNetAmount += earning.netAmount;
      }
      if (earning.status === 'AVAILABLE') {
        summary.availableNetAmount += earning.netAmount;
      }
      if (earning.status === 'PAID') {
        summary.paidNetAmount += earning.netAmount;
      }
      return summary;
    },
    {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency,
    },
  );
}

function paymentNeedsReference(payment: AdminPayment) {
  return (
    OPEN_PAYMENT_REFERENCE_STATUSES.includes(payment.status) &&
    !payment.providerRef &&
    payment.method !== 'CASH'
  );
}

function refundNeedsCloseout(refund: AdminRefund) {
  return refund.status !== 'COMPLETED';
}

function payoutNeedsCloseout(batch: AdminPayoutBatch) {
  return !CLOSED_PAYOUT_STATUSES.includes(batch.status);
}

function payoutNeedsReference(batch: AdminPayoutBatch) {
  return PAYOUT_REFERENCE_REQUIRED_STATUSES.includes(batch.status) && !batch.transferRef;
}
