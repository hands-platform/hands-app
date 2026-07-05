import type { AdminEarning, AdminEarningSummary, AdminPayoutBatch } from '../../lib/admin-api';
import {
  buildCashBookingAccountingPreview,
  buildCashBookingAccountingPreviewText,
} from '../../lib/cash-booking-accounting-preview';
import { formatMoney, formatRelativeTime, shortRecordId } from '../../lib/admin-format';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  isPostMatchCancellationEarning,
  postMatchCancellationEarningDisplay,
} from '../bookings/booking-post-match-cancellation-earning';
import type { EarningsBatchStateCard } from './earnings-batch-state-filter-section';
import type { EarningsCashDebtQueueItem } from './earnings-cash-debt-queue-section';
import type { EarningsFinanceSignal } from './earnings-finance-queue-section';
import type { EarningsLedgerRow } from './earnings-ledger-section';
import type { EarningsMoneyFlowCard, EarningsMoneyFlowCheck } from './earnings-money-flow-section';
import type { EarningsPartnerPayoutQueueGroup } from './earnings-partner-payout-queue-section';
import type { EarningsServiceBridgeItem } from './earnings-service-bridge-section';

export const emptySummary: AdminEarningSummary = {
  count: 0,
  grossAmount: 0,
  platformFee: 0,
  withholdingAmount: 0,
  netAmount: 0,
  pendingNetAmount: 0,
  availableNetAmount: 0,
  paidNetAmount: 0,
  currency: 'VND',
};

type ProviderPayoutQueueItem = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  unbatchedCount: number;
  unbatchedNet: number;
  withholdingAmount: number;
  cashDebtAmount: number;
  walletBalance: number;
  status: string;
  canBatch: boolean;
  nextAction: string;
  activeBatch?: AdminPayoutBatch;
};

type CashDebtQueueItem = {
  earning: AdminEarning;
  providerName: string;
  paymentMethod: string;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  bookingAmount: number;
  settlementReference: string;
  lastLedgerRef?: string | null;
  settlementChecklist: string[];
};

type MutableEarningsServiceBridgeItem = {
  -readonly [Key in keyof EarningsServiceBridgeItem]: EarningsServiceBridgeItem[Key];
};

type ServicePayoutSnapshotLine = {
  serviceId?: string;
  customerPrice?: number | string;
  providerPayoutAmount?: number | string;
  platformFeeAmount?: number | string;
  vatAmount?: number | string;
  otherCostAmount?: number | string;
};

type EarningBatchState = 'all' | 'ready' | 'cash-debt' | 'closeout-review' | 'batched' | 'paid';

const earningBatchStateOptions: Array<{ state: EarningBatchState; label: string }> = [
  { state: 'all', label: 'All rows' },
  { state: 'ready', label: 'Batch ready' },
  { state: 'cash-debt', label: 'Cash fee debt' },
  { state: 'closeout-review', label: 'Closeout review' },
  { state: 'batched', label: 'Already batched' },
  { state: 'paid', label: 'Paid' },
];
const EARNING_OPERATIONS_API_LIMIT = 10;
const EARNING_OPERATIONS_API_MAX_LIMIT = 50;

export function buildEarningPayoutConfirmationRows(
  payoutQueue: ProviderPayoutQueueItem[],
  ledgerEarnings: AdminEarning[],
) {
  const rows = new Map<
    string,
    {
      currency: string;
      providerName: string;
      providerProfileId: string;
      transferRef: string;
      unbatchedCount: number;
      unbatchedNet: number;
    }
  >();

  payoutQueue
    .filter((item) => item.canBatch)
    .forEach((item) => {
      rows.set(item.providerProfileId, {
        currency: item.currency,
        providerName: item.providerName,
        providerProfileId: item.providerProfileId,
        transferRef: `HANDS-${shortRecordId(item.providerProfileId)}`,
        unbatchedCount: item.unbatchedCount,
        unbatchedNet: item.unbatchedNet,
      });
    });

  ledgerEarnings.filter(canCreatePayout).forEach((earning) => {
    if (rows.has(earning.providerProfileId)) {
      return;
    }

    rows.set(earning.providerProfileId, {
      currency: earning.currency,
      providerName: providerDisplayName(earning),
      providerProfileId: earning.providerProfileId,
      transferRef: `MVP-${earning.providerProfileId}`,
      unbatchedCount: 1,
      unbatchedNet: earning.netAmount,
    });
  });

  return [...rows.values()];
}

export function buildPartnerPayoutQueueGroups(
  payoutQueue: readonly ProviderPayoutQueueItem[],
): EarningsPartnerPayoutQueueGroup[] {
  return payoutQueue.map((group) => ({
    activeBatchSummary: group.activeBatch
      ? `Existing batch ${shortRecordId(group.activeBatch.id)} is ${group.activeBatch.status}.`
      : null,
    canBatch: group.canBatch,
    cashDebtAmount: group.cashDebtAmount,
    currency: group.currency,
    nextAction: group.nextAction,
    providerHref: `/partners/${group.providerProfileId}`,
    providerName: group.providerName,
    providerProfileId: group.providerProfileId,
    status: group.status,
    transferRef: `HANDS-${shortRecordId(group.providerProfileId)}`,
    unbatchedCount: group.unbatchedCount,
    unbatchedNet: group.unbatchedNet,
    walletBalance: group.walletBalance,
    withholdingAmount: group.withholdingAmount,
  }));
}

export function buildEarningsLedgerRows(earnings: readonly AdminEarning[]): EarningsLedgerRow[] {
  return earnings.map((earning) => {
    const cancellationDisplay = postMatchCancellationEarningDisplay(earning);

    return {
      bookingHref: `/bookings/${earning.bookingId}`,
      bookingPaymentMethod: earning.booking?.payment?.method ?? 'UNKNOWN',
      bookingShortId: shortRecordId(earning.bookingId),
      cashAccountingPreview: isCashDebt(earning)
        ? buildCashBookingAccountingPreview({
            currency: earning.currency,
            debtAmount: Math.abs(earning.netAmount),
            platformFee: earning.platformFee,
            taxAmount: earning.withholdingAmount ?? 0,
            walletLedgerMetadata: earning.walletLedgerEntries?.map((entry) => entry.metadata),
          })
        : [],
      canCreatePayout: canCreatePayout(earning),
      canDirectlyPay: canDirectlyPay(earning),
      cancellationDecisionLabel: cancellationDisplay?.decisionLabel ?? null,
      cancellationDecisionTone: cancellationDisplay?.decisionTone ?? null,
      cancellationFeeLabel: cancellationDisplay?.feeLabel ?? null,
      cancellationFeeTone: cancellationDisplay?.feeTone ?? null,
      createdAtLabel: earning.createdAt
        ? formatRelativeTime(earning.createdAt, { includeFuture: true })
        : 'No create time',
      feePolicyHint: platformFeePolicyHint(earning),
      grossAmountLabel: formatMoney(earning.grossAmount, earning.currency),
      id: earning.id,
      netAmountLabel: formatMoney(earning.netAmount, earning.currency),
      netCompanyFeeHint: netCompanyFeeHint(earning),
      payoutBatchHref: earning.payoutBatchId ? `/payouts#${earning.payoutBatchId}` : null,
      payoutBatchLabel: earning.payoutBatchId ? shortRecordId(earning.payoutBatchId) : null,
      platformFeeLabel: `${formatMoney(earning.platformFee, earning.currency)} platform fee`,
      providerName: providerDisplayName(earning),
      providerPhone: earning.providerProfile?.user?.phone ?? 'No phone on file',
      providerProfileId: earning.providerProfileId,
      settlementMethodLabel: earning.settlementMethod
        ? settlementMethodLabel(earning.settlementMethod)
        : null,
      settlementRef: earning.settlementRef ?? null,
      signalClassName: earningSignalClass(earning),
      statusHint: earningHint(earning),
      statusLabel: earningStatusLabel(earning),
      taxPolicyHint: taxPolicyHint(earning),
      transferRef: `MVP-${earning.providerProfileId}`,
      walletEntries: (earning.walletLedgerEntries ?? [])
        .slice(0, 2)
        .map((entry) => `Wallet ${entry.type}: ${formatMoney(entry.amount, entry.currency)}`),
      withholdingAmountLabel: `${formatMoney(earning.withholdingAmount ?? 0, earning.currency)} tax withheld`,
    };
  });
}

export function sortEarnings(earnings: AdminEarning[]) {
  return [...earnings].sort((left, right) => {
    const priorityDiff = earningPriority(left) - earningPriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
  });
}

export function buildEarningFilters(params: Record<string, string | string[] | undefined>) {
  const rangeParam = readSearchParam(params.range);

  return {
    page: readEarningPage(params.page),
    pageSize: readEarningPageSize(params.pageSize),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    batchState: normalizeEarningBatchState(readSearchParam(params.batchState)),
  };
}

export function buildEarningOperationsApiHrefs(filters: ReturnType<typeof buildEarningFilters>) {
  const earningParams = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
  });
  const earningReview = earningBatchStateApiReview(filters.batchState);
  if (earningReview) {
    earningParams.set('review', earningReview);
  }
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) {
    earningParams.set('skip', String(skip));
  }
  const payoutBatchParams = new URLSearchParams({
    range: filters.range,
    take: String(EARNING_OPERATIONS_API_LIMIT),
  });
  payoutBatchParams.set('review', 'needs-review');

  return {
    earningsHref: `/admin/earnings?${earningParams.toString()}`,
    earningsSummaryHref: `/admin/earnings/summary?range=${filters.range}`,
    payoutBatchesHref: `/admin/payout-batches?${payoutBatchParams.toString()}`,
  };
}

function earningBatchStateApiReview(state: EarningBatchState) {
  if (
    state === 'ready' ||
    state === 'cash-debt' ||
    state === 'closeout-review' ||
    state === 'batched' ||
    state === 'paid'
  ) {
    return state;
  }
  return null;
}

export function buildEarningServerPagination<T>(
  rows: readonly T[],
  filters: ReturnType<typeof buildEarningFilters>,
  totalRows: number,
) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    hrefForPage: (nextPage: number) => earningHref({ ...filters, page: nextPage }),
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

function earningHref(filters: ReturnType<typeof buildEarningFilters>) {
  const params = new URLSearchParams();
  if (filters.range !== 'today') {
    params.set('range', filters.range);
  }
  if (filters.batchState !== 'all') {
    params.set('batchState', filters.batchState);
  }
  if (filters.pageSize !== EARNING_OPERATIONS_API_LIMIT) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  const query = params.toString();
  return query ? `/earnings?${query}` : '/earnings';
}

export function summarizeEarnings(earnings: AdminEarning[], currency: string): AdminEarningSummary {
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

function normalizeEarningBatchState(value: string): EarningBatchState {
  return earningBatchStateOptions.find((option) => option.state === value)?.state ?? 'all';
}

function readEarningPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readEarningPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(readSearchParam(value), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return EARNING_OPERATIONS_API_LIMIT;
  }
  return Math.min(Math.trunc(pageSize), EARNING_OPERATIONS_API_MAX_LIMIT);
}

export function filterEarningsByBatchState(earnings: AdminEarning[], state: EarningBatchState) {
  if (state === 'all') {
    return earnings;
  }
  return earnings.filter((earning) => earningBatchState(earning) === state);
}

export function buildEarningBatchStateCards(
  earnings: AdminEarning[],
  range: ReturnType<typeof buildEarningFilters>['range'],
): EarningsBatchStateCard[] {
  return earningBatchStateOptions.map((option) => {
    const stateEarnings = filterEarningsByBatchState(earnings, option.state);
    return {
      ...option,
      count: stateEarnings.length,
      amount: stateEarnings.reduce((sum, earning) => sum + earning.netAmount, 0),
      href: earningBatchStateHref(range, option.state),
    };
  });
}

function earningBatchStateHref(
  range: ReturnType<typeof buildEarningFilters>['range'],
  state: EarningBatchState,
) {
  const params = new URLSearchParams();
  if (range !== 'all') {
    params.set('range', range);
  }
  if (state !== 'all') {
    params.set('batchState', state);
  }
  const query = params.toString();
  return query ? `/earnings?${query}` : '/earnings';
}

function earningBatchState(earning: AdminEarning): EarningBatchState | 'cancelled' {
  if (isCashDebt(earning)) {
    return 'cash-debt';
  }
  if (earning.status === 'PAID') {
    return 'paid';
  }
  if (earning.status === 'CANCELLED') {
    return 'cancelled';
  }
  if (earning.payoutBatchId) {
    return 'batched';
  }
  if (isEarningReadyForBatch(earning)) {
    return 'ready';
  }
  return 'closeout-review';
}

function isEarningReadyForBatch(earning: AdminEarning) {
  return canCreatePayout(earning) && earning.booking?.status === 'COMPLETED';
}

export function buildCashDebtQueue(earnings: AdminEarning[]): CashDebtQueueItem[] {
  return earnings
    .filter((earning) => isCashDebt(earning))
    .map((earning) => {
      const debtAmount = Math.abs(earning.netAmount);
      const platformFee = earning.platformFee;
      const taxAmount = earning.withholdingAmount ?? 0;
      const bookingAmount = earning.booking?.payment?.amount ?? earning.grossAmount;
      const settlementReference = cashDebtSettlementReference(earning.providerProfileId);
      const lastLedgerRef = earning.walletLedgerEntries?.[0]?.reference ?? null;

      return {
        earning,
        providerName: providerDisplayName(earning),
        paymentMethod: earning.booking?.payment?.method ?? 'CASH',
        debtAmount,
        platformFee,
        taxAmount,
        bookingAmount,
        settlementReference,
        lastLedgerRef,
        settlementChecklist: [
          `Confirm Partner deposit or approved offset before settling ${settlementReference}.`,
          'Keep the reference on the bank transfer, chat evidence, or admin offset memo.',
          'Recheck payout queue after settlement.',
        ],
      };
    })
    .sort((left, right) => right.debtAmount - left.debtAmount);
}

function cashDebtSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

export function buildCashDebtTotals(queue: CashDebtQueueItem[]) {
  return queue.reduce(
    (totals, item) => ({
      debtAmount: totals.debtAmount + item.debtAmount,
      platformFee: totals.platformFee + item.platformFee,
      taxAmount: totals.taxAmount + item.taxAmount,
      bookingAmount: totals.bookingAmount + item.bookingAmount,
    }),
    {
      debtAmount: 0,
      platformFee: 0,
      taxAmount: 0,
      bookingAmount: 0,
    },
  );
}

export function buildCashDebtQueueItems(queue: readonly CashDebtQueueItem[]): EarningsCashDebtQueueItem[] {
  return queue.map((item) => {
    const cashAccountingPreviewInput = {
      currency: item.earning.currency,
      debtAmount: item.debtAmount,
      platformFee: item.platformFee,
      taxAmount: item.taxAmount,
      walletLedgerMetadata: item.earning.walletLedgerEntries?.map((entry) => entry.metadata),
    };
    return {
      bookingAmount: item.bookingAmount,
      bookingHref: `/bookings/${item.earning.bookingId}`,
      bookingShortId: shortRecordId(item.earning.bookingId),
      cashAccountingPreview: buildCashBookingAccountingPreview(cashAccountingPreviewInput),
      cashAccountingPreviewText: buildCashBookingAccountingPreviewText(cashAccountingPreviewInput),
      currency: item.earning.currency,
      debtAmount: item.debtAmount,
      earningId: item.earning.id,
      lastLedgerRef: item.lastLedgerRef ?? null,
      partnerHref: `/partners/${item.earning.providerProfileId}`,
      paymentMethod: item.paymentMethod,
      platformFee: item.platformFee,
      providerName: item.providerName,
      settlementChecklist: item.settlementChecklist,
      settlementNotes: `Cash fee debt settled from admin earnings queue with reference ${item.settlementReference}`,
      settlementReference: item.settlementReference,
      taxAmount: item.taxAmount,
    };
  });
}

export function buildEarningsMoneyFlowCards(
  summary: AdminEarningSummary,
  serviceBridge: EarningsServiceBridgeItem[],
  cashDebtTotals: ReturnType<typeof buildCashDebtTotals>,
): EarningsMoneyFlowCard[] {
  const bridgeGross = sumServiceBridge(serviceBridge, 'grossAmount');
  const providerPayout = sumServiceBridge(serviceBridge, 'providerPayoutAmount');
  const netCompanyFee = sumServiceBridge(serviceBridge, 'netCompanyFee');
  const vatAndCost =
    sumServiceBridge(serviceBridge, 'vatAmount') + sumServiceBridge(serviceBridge, 'otherCostAmount');

  return [
    {
      label: 'Customer charge',
      amount: bridgeGross || summary.grossAmount,
      detail: 'Gross customer payment across completed earning rows.',
    },
    {
      label: 'Partner payout',
      amount: providerPayout || summary.netAmount,
      detail: 'Service pricing matrix payout before wallet debt and batch status.',
    },
    {
      label: 'HANDS fee',
      amount: summary.platformFee,
      detail: 'Total platform fee before VAT, withholding, and operating cost allocation.',
    },
    {
      label: 'Tax withheld',
      amount: summary.withholdingAmount,
      detail: 'Freelancer withholding already attached to earning records.',
    },
    {
      label: 'Company net',
      amount: netCompanyFee || Math.max(0, summary.platformFee - summary.withholdingAmount - vatAndCost),
      detail: 'Estimated HANDS fee after configured tax and cost deductions.',
    },
    {
      label: 'Cash debt',
      amount: cashDebtTotals.debtAmount,
      detail:
        'Negative wallet amount from cash jobs that must be settled before final acceptance, service start, or payout release resumes.',
    },
  ];
}

export function buildEarningsMoneyFlowChecks(
  summary: AdminEarningSummary,
  serviceBridge: EarningsServiceBridgeItem[],
  cashDebtQueue: CashDebtQueueItem[],
): EarningsMoneyFlowCheck[] {
  const bridgeGross = sumServiceBridge(serviceBridge, 'grossAmount');
  const bridgePlatformFee = sumServiceBridge(serviceBridge, 'platformFee');
  const unlinkedOptions = serviceBridge.filter((item) => item.label === 'Unlinked service option');
  const grossGap = Math.abs(summary.grossAmount - bridgeGross);
  const feeGap = Math.abs(summary.platformFee - bridgePlatformFee);
  const hasBridgeRows = serviceBridge.length > 0;

  return [
    {
      title: 'Booking service link',
      status: `${unlinkedOptions.length} UNLINKED`,
      detail: unlinkedOptions.length
        ? 'Some earning rows still do not point to a configured service duration option.'
        : 'Every visible earning can be traced to a service option or fallback row.',
      action: unlinkedOptions.length
        ? 'Open service pricing and reconnect missing booking service references.'
        : 'Service option trace is ready for finance review.',
      className: unlinkedOptions.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: unlinkedOptions.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Gross reconciliation',
      status: hasBridgeRows && grossGap > 0 ? 'CHECK' : 'MATCHED',
      detail: hasBridgeRows
        ? `Summary versus service bridge gap: ${formatMoney(grossGap, summary.currency)}.`
        : 'No service bridge rows are available yet.',
      action:
        hasBridgeRows && grossGap > 0
          ? 'Review cancelled rows, manual earning edits, or missing service links.'
          : 'Customer charge totals reconcile with the service bridge.',
      className: hasBridgeRows && grossGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: hasBridgeRows && grossGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Fee reconciliation',
      status: hasBridgeRows && feeGap > 0 ? 'CHECK' : 'MATCHED',
      detail: hasBridgeRows
        ? `Platform fee bridge gap: ${formatMoney(feeGap, summary.currency)}.`
        : 'No fee bridge rows are available yet.',
      action:
        hasBridgeRows && feeGap > 0
          ? 'Confirm fee policy snapshots before payout approval.'
          : 'HANDS fee totals are aligned across earnings and service rows.',
      className: hasBridgeRows && feeGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: hasBridgeRows && feeGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Cash job lock',
      status: `${cashDebtQueue.length} Partner(s)`,
      detail: cashDebtQueue.length
        ? 'Negative wallet Partners must settle company fee before final acceptance, service start, or payout release resumes.'
        : 'No cash fee debt currently blocks final acceptance, service start, or payout release.',
      action: cashDebtQueue.length
        ? 'Use cash debt queue to confirm deposit or approved offset.'
        : 'Marketplace and payout gates are clear for listed earnings.',
      className: cashDebtQueue.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtQueue.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function sumServiceBridge(
  serviceBridge: EarningsServiceBridgeItem[],
  field: keyof Pick<
    EarningsServiceBridgeItem,
    | 'grossAmount'
    | 'netAmount'
    | 'providerPayoutAmount'
    | 'platformFee'
    | 'vatAmount'
    | 'otherCostAmount'
    | 'withholdingAmount'
    | 'netCompanyFee'
    | 'cashDebtAmount'
  >,
) {
  return serviceBridge.reduce((sum, item) => sum + item[field], 0);
}

export function buildServiceEarningBridge(earnings: AdminEarning[]): EarningsServiceBridgeItem[] {
  const grouped = new Map<string, MutableEarningsServiceBridgeItem>();

  earnings.forEach((earning) => {
    if (earning.status === 'CANCELLED') {
      return;
    }

    const bookingServices =
      earning.booking?.services && earning.booking.services.length > 0
        ? earning.booking.services
        : [
            {
              id: `earning-${earning.id}`,
              serviceId: 'unknown-service',
              quantity: 1,
              price: earning.grossAmount,
              service: null,
            },
          ];

    const allocationBase =
      bookingServices.reduce(
        (sum, bookingService) =>
          sum + Number(bookingService.price ?? 0) * Math.max(1, Number(bookingService.quantity ?? 1)),
        0,
      ) ||
      earning.grossAmount ||
      1;

    bookingServices.forEach((bookingService) => {
      const quantity = Math.max(1, Number(bookingService.quantity ?? 1));
      const serviceGross = Number(bookingService.price ?? 0) * quantity;
      const allocationShare = allocationBase > 0 ? serviceGross / allocationBase : 1 / bookingServices.length;
      const service = bookingService.service;
      const key = service?.id ?? bookingService.serviceId ?? 'unknown-service';
      const duration = service?.durationMin ? `${service.durationMin} min` : 'duration not linked';
      const label = service?.name ? `${service.name} / ${duration}` : 'Unlinked service option';
      const payoutLine = servicePayoutLineFor(earning, bookingService);
      const providerPayoutAmount =
        readAmount(payoutLine?.providerPayoutAmount) ||
        Math.max(0, serviceGross - Math.round(earning.platformFee * allocationShare));
      const platformFeeAmount =
        readAmount(payoutLine?.platformFeeAmount) || Math.round(earning.platformFee * allocationShare);
      const vatAmount = readAmount(payoutLine?.vatAmount);
      const otherCostAmount = readAmount(payoutLine?.otherCostAmount);
      const withholdingAmount = Math.round((earning.withholdingAmount ?? 0) * allocationShare);
      const item = grouped.get(key) ?? {
        key,
        label,
        groupKey: service?.serviceGroupKey ?? bookingService.serviceId ?? 'unknown',
        currency: earning.currency,
        bookingCount: 0,
        cashBookingCount: 0,
        grossAmount: 0,
        netAmount: 0,
        providerPayoutAmount: 0,
        platformFee: 0,
        vatAmount: 0,
        otherCostAmount: 0,
        withholdingAmount: 0,
        netCompanyFee: 0,
        cashDebtAmount: 0,
        matrixBackedCount: 0,
        unbatchedCount: 0,
        batchedCount: 0,
        paidCount: 0,
      };

      item.bookingCount += 1;
      if (earning.booking?.payment?.method === 'CASH') {
        item.cashBookingCount += 1;
      }
      item.grossAmount += Math.round(earning.grossAmount * allocationShare);
      item.netAmount += Math.round(earning.netAmount * allocationShare);
      item.providerPayoutAmount += providerPayoutAmount;
      item.platformFee += platformFeeAmount;
      item.vatAmount += vatAmount;
      item.otherCostAmount += otherCostAmount;
      item.withholdingAmount += withholdingAmount;
      item.netCompanyFee += platformFeeAmount - vatAmount - otherCostAmount - withholdingAmount;
      if (payoutLine) {
        item.matrixBackedCount += 1;
      }
      if (earning.netAmount < 0 && !isPostMatchCancellationEarning(earning)) {
        item.cashDebtAmount += Math.round(Math.abs(earning.netAmount) * allocationShare);
      }
      if (earning.status === 'PAID') {
        item.paidCount += 1;
      } else if (earning.payoutBatchId) {
        item.batchedCount += 1;
      } else {
        item.unbatchedCount += 1;
      }

      grouped.set(key, item);
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.grossAmount - left.grossAmount || left.label.localeCompare(right.label))
    .slice(0, 12);
}

function servicePayoutLineFor(
  earning: AdminEarning,
  bookingService: NonNullable<NonNullable<AdminEarning['booking']>['services']>[number],
) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  const snapshot = latestFeeLog?.ruleSnapshot as
    | { source?: string; lines?: ServicePayoutSnapshotLine[] }
    | undefined;
  if (snapshot?.source !== 'SERVICE_PAYOUT_RULE' || !Array.isArray(snapshot.lines)) {
    return null;
  }
  const serviceId = bookingService.service?.id ?? bookingService.serviceId;
  const customerPrice = readAmount(bookingService.price);
  return (
    snapshot.lines.find(
      (line) => line.serviceId === serviceId && readAmount(line.customerPrice) === customerPrice,
    ) ?? null
  );
}

function readAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  return 0;
}

export function buildProviderPayoutQueue(earnings: AdminEarning[], payoutBatches: AdminPayoutBatch[]) {
  const activeBatchByProvider = new Map<string, AdminPayoutBatch>();
  payoutBatches
    .filter((batch) => batch.status !== 'PAID' && batch.status !== 'CANCELLED')
    .forEach((batch) => {
      if (!activeBatchByProvider.has(batch.providerProfileId)) {
        activeBatchByProvider.set(batch.providerProfileId, batch);
      }
    });

  const grouped = new Map<string, ProviderPayoutQueueItem>();
  earnings.forEach((earning) => {
    if (earning.status === 'PAID' || earning.status === 'CANCELLED') {
      return;
    }

    const existing = grouped.get(earning.providerProfileId);
    const activeBatch = activeBatchByProvider.get(earning.providerProfileId);
    const providerName = providerDisplayName(earning);
    const item = existing ?? {
      providerProfileId: earning.providerProfileId,
      providerName,
      currency: earning.currency,
      unbatchedCount: 0,
      unbatchedNet: 0,
      withholdingAmount: 0,
      cashDebtAmount: 0,
      walletBalance: 0,
      status: activeBatch ? 'BATCHED' : 'READY',
      canBatch: false,
      nextAction: 'Create a payout batch after finance review.',
      activeBatch,
    };

    item.withholdingAmount += earning.withholdingAmount ?? 0;
    if (!earning.payoutBatchId) {
      item.walletBalance += earning.netAmount;
    }
    if (!earning.payoutBatchId && earning.netAmount > 0) {
      item.unbatchedCount += 1;
      item.unbatchedNet += earning.netAmount;
    }
    if (!earning.payoutBatchId && earning.netAmount < 0 && !isPostMatchCancellationEarning(earning)) {
      item.cashDebtAmount += Math.abs(earning.netAmount);
    }

    grouped.set(earning.providerProfileId, item);
  });

  return [...grouped.values()]
    .map((item) => {
      const hasCashDebt = item.cashDebtAmount > 0;
      const canBatch = item.unbatchedCount > 0 && !item.activeBatch && !hasCashDebt;
      return {
        ...item,
        canBatch,
        status: hasCashDebt ? 'HOLD' : item.activeBatch ? 'BATCHED' : canBatch ? 'READY' : 'WAIT',
        nextAction: item.activeBatch
          ? 'Continue from payout batches before creating another batch.'
          : hasCashDebt
            ? 'Settle or offset the cash fee debt before creating a payout batch.'
            : canBatch
              ? 'Create one batch for all currently eligible unpaid earnings.'
              : 'No unbatched positive earning is available for this Partner.',
      };
    })
    .sort((left, right) => {
      if (left.cashDebtAmount !== right.cashDebtAmount) {
        return right.cashDebtAmount - left.cashDebtAmount;
      }
      if (left.canBatch !== right.canBatch) {
        return left.canBatch ? -1 : 1;
      }
      return right.unbatchedNet - left.unbatchedNet;
    });
}

export function buildFinanceSignals(
  earnings: AdminEarning[],
  payoutBatches: AdminPayoutBatch[],
  payoutQueue: ProviderPayoutQueueItem[],
  cashDebtQueue: CashDebtQueueItem[],
): EarningsFinanceSignal[] {
  const readyProviders = payoutQueue.filter((item) => item.canBatch);
  const batchedUnpaid = earnings.filter(
    (earning) => earning.payoutBatchId && earning.status !== 'PAID' && earning.status !== 'CANCELLED',
  );
  const missingTaxLogs = earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const stalePending = earnings.filter((earning) => {
    if (earning.status !== 'PENDING' || !earning.availableAt) {
      return false;
    }
    return Date.parse(earning.availableAt) < Date.now();
  });
  const activeBatches = payoutBatches.filter(
    (batch) => batch.status !== 'PAID' && batch.status !== 'CANCELLED',
  );

  return [
    {
      title: 'Ready to batch',
      status: `${readyProviders.length} Partner(s)`,
      detail: formatMoney(
        readyProviders.reduce((sum, item) => sum + item.unbatchedNet, 0),
        'VND',
      ),
      action: readyProviders.length
        ? 'Create batches from the Partner queue below.'
        : 'No Partner is ready to batch.',
      className: readyProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: readyProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Active batches',
      status: `${activeBatches.length} OPEN`,
      detail: formatMoney(
        activeBatches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        'VND',
      ),
      action: activeBatches.length ? 'Move DRAFT/PROCESSING batches from payouts.' : 'No open payout batch.',
      className: activeBatches.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: activeBatches.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Batched unpaid rows',
      status: `${batchedUnpaid.length} ROW(S)`,
      detail: formatMoney(
        batchedUnpaid.reduce((sum, earning) => sum + earning.netAmount, 0),
        'VND',
      ),
      action: batchedUnpaid.length
        ? 'Follow the payout batch, not direct paid action.'
        : 'No batched unpaid row.',
      className: batchedUnpaid.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: batchedUnpaid.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Cash fee debt',
      status: `${cashDebtQueue.length} WALLET(S)`,
      detail: formatMoney(
        cashDebtQueue.reduce((sum, item) => sum + Math.abs(item.earning.netAmount), 0),
        'VND',
      ),
      action: cashDebtQueue.length
        ? 'Confirm Partner deposit or offset, then mark fee settled.'
        : 'No negative cash wallet needs settlement.',
      className: cashDebtQueue.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtQueue.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Audit warnings',
      status: `${missingTaxLogs.length + stalePending.length} CHECK`,
      detail: `${missingTaxLogs.length} missing tax log(s), ${stalePending.length} pending after available time.`,
      action:
        missingTaxLogs.length || stalePending.length
          ? 'Review tax policy or earning availability before payment.'
          : 'Tax and availability signals look consistent.',
      className: missingTaxLogs.length || stalePending.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: missingTaxLogs.length || stalePending.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function earningPriority(earning: AdminEarning) {
  if (isCashDebt(earning)) {
    return -1;
  }
  if (earning.status === 'CANCELLED') {
    return 5;
  }
  if (earning.status === 'PAID') {
    return 4;
  }
  if (earning.payoutBatchId) {
    return 2;
  }
  if (earning.status === 'AVAILABLE') {
    return 0;
  }
  return 1;
}

function providerDisplayName(earning: AdminEarning) {
  return earning.providerProfile?.displayName ?? earning.providerProfile?.user?.phone ?? 'Unknown Partner';
}

function earningSignalClass(earning: AdminEarning) {
  if (earning.status === 'PAID') {
    return 'signal signal-ok';
  }
  if (earning.status === 'CANCELLED') {
    return 'signal signal-warn';
  }
  if (earning.payoutBatchId) {
    return 'signal signal-info';
  }
  return 'signal signal-warn';
}

function earningStatusLabel(earning: AdminEarning) {
  if (isPostMatchCancellationEarning(earning)) {
    return 'Post-match cancellation';
  }
  if (earning.payoutBatchId && earning.status !== 'PAID') {
    return `${earning.status} / batched`;
  }
  return earning.status;
}

function earningHint(earning: AdminEarning) {
  const cancellationDisplay = postMatchCancellationEarningDisplay(earning);
  if (cancellationDisplay) {
    return `${cancellationDisplay.decisionLabel}; ${cancellationDisplay.feeLabel}.`;
  }
  if (isCashDebt(earning)) {
    return 'Cash fee debt blocks Partner wallet until settled';
  }
  if (earning.status === 'PAID') {
    return earning.paidAt
      ? `Paid ${formatRelativeTime(earning.paidAt, { includeFuture: true })}`
      : 'Paid without timestamp';
  }
  if (earning.status === 'CANCELLED') {
    return 'Cancelled by refund or booking reversal';
  }
  if (earning.payoutBatchId) {
    return 'Follow this from the payout batch screen';
  }
  if (earning.availableAt) {
    return `Available ${formatRelativeTime(earning.availableAt, { includeFuture: true })}`;
  }
  return 'Ready for finance review';
}

function taxPolicyHint(earning: AdminEarning) {
  const latestTaxLog = earning.taxLogs?.[0];
  if (!latestTaxLog) {
    return 'No tax log yet';
  }
  const snapshot = latestTaxLog.ruleSnapshot as
    | { scope?: string; reason?: string; rateBps?: number }
    | undefined;
  if (snapshot?.reason) {
    return `Tax policy: ${snapshot.reason}`;
  }
  return `Tax policy: ${snapshot?.scope ?? 'RULE'} at ${((snapshot?.rateBps ?? 0) / 100).toFixed(2)}%`;
}

function platformFeePolicyHint(earning: AdminEarning) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  if (!latestFeeLog) {
    return 'Fee policy: no log yet';
  }
  const snapshot = latestFeeLog.ruleSnapshot as
    | {
        source?: string;
        scope?: string;
        rateBps?: number;
        fixedAmount?: number;
        providerPayoutAmount?: number;
        vatAmount?: number;
        otherCostAmount?: number;
      }
    | undefined;
  if (snapshot?.source === 'SERVICE_PAYOUT_RULE') {
    return `Fee policy: service payout matrix / Partner payout ${formatMoney(
      snapshot.providerPayoutAmount ?? 0,
      earning.currency,
    )}`;
  }
  return `Fee policy: ${snapshot?.scope ?? 'RULE'} at ${((snapshot?.rateBps ?? 0) / 100).toFixed(2)}%`;
}

function netCompanyFeeHint(earning: AdminEarning) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  const snapshot = latestFeeLog?.ruleSnapshot as
    | {
        source?: string;
        vatAmount?: number;
        otherCostAmount?: number;
      }
    | undefined;
  const vatAmount = snapshot?.vatAmount ?? 0;
  const otherCostAmount = snapshot?.otherCostAmount ?? 0;
  const netCompanyFee = earning.platformFee - (earning.withholdingAmount ?? 0) - vatAmount - otherCostAmount;
  if (snapshot?.source === 'SERVICE_PAYOUT_RULE') {
    return `Net company fee after VAT/tax/cost: ${formatMoney(netCompanyFee, earning.currency)}`;
  }
  return `Net company fee estimate: ${formatMoney(netCompanyFee, earning.currency)}`;
}

function canDirectlyPay(earning: AdminEarning) {
  return isCashDebt(earning);
}

function canCreatePayout(earning: AdminEarning) {
  return (
    Boolean(earning.providerProfile) &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    earning.netAmount > 0 &&
    !earning.payoutBatchId
  );
}

export function isCashDebt(earning: AdminEarning) {
  return (
    earning.netAmount < 0 &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    !earning.payoutBatchId &&
    !isPostMatchCancellationEarning(earning)
  );
}

function settlementMethodLabel(method: string) {
  if (method === 'PARTNER_DEPOSIT') {
    return 'Partner deposit';
  }
  if (method === 'ADMIN_OFFSET') {
    return 'Admin offset';
  }
  return method;
}
