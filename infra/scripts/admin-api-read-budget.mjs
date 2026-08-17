import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000/api';
const DEFAULT_SAMPLES = 5;
const DEFAULT_WARMUPS = 1;
const DEFAULT_TIMEOUT_MS = 5_000;

const coreReadTargets = [
  {
    label: 'partners-list',
    path: '/admin/partners/list-providers?take=10',
    budget: { p90Ms: 500, maxBytes: 64 * 1024 },
  },
  {
    label: 'partners-summary',
    path: '/admin/partners/list-providers/summary',
    budget: { p90Ms: 400, maxBytes: 8 * 1024 },
  },
  {
    label: 'partner-analytics-overview',
    path: '/admin/partners/overview?range=7d&includeActionRows=false&previewLimit=5',
    budget: { p90Ms: 1_000, maxBytes: 48 * 1024 },
  },
  {
    label: 'services-operational',
    path: '/admin/services?scope=operational',
    budget: { p90Ms: 500, maxBytes: 16 * 1024 },
  },
  {
    label: 'bookings-list',
    path: '/admin/bookings?take=1',
    budget: { p90Ms: 750, maxBytes: 128 * 1024 },
  },
  {
    label: 'start-shift-summary',
    path: '/admin/dashboard/start-shift-summary?dateRange=7d',
    budget: { p90Ms: 750, maxBytes: 96 * 1024 },
  },
];

const financeReadTargets = [
  {
    label: 'payment-clearing-list',
    path: '/admin/booking-payment-clearing?take=20&range=30d&review=all',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'payment-clearing-summary',
    path: '/admin/booking-payment-clearing/summary?range=30d&review=all',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'payment-clearing-review-owner-summary',
    path: '/admin/booking-payment-clearing/review-owner-summary?range=30d&review=open',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'payment-clearing-48h-list',
    path: '/admin/booking-payment-clearing?take=20&range=all&review=open&age=48h',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'payment-clearing-48h-summary',
    path: '/admin/booking-payment-clearing/summary?range=all&review=open&age=48h',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'payment-clearing-48h-review-owner-summary',
    path: '/admin/booking-payment-clearing/review-owner-summary?range=all&review=open&age=48h',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'general-ledger-list',
    path: '/admin/accounting-journal-batches?take=20&range=30d&review=all',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'general-ledger-summary',
    path: '/admin/accounting-journal-batches/summary?range=30d&review=all',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'bank-reconciliation-list',
    path: '/admin/bank-reconciliation?take=20&range=30d&review=all',
    budget: { p90Ms: 1_000, maxBytes: 192 * 1024 },
  },
  {
    label: 'bank-reconciliation-summary',
    path: '/admin/bank-reconciliation/summary?range=30d&review=all',
    budget: { p90Ms: 750, maxBytes: 64 * 1024 },
  },
  {
    label: 'bank-reconciliation-review-owner-summary',
    path: '/admin/bank-reconciliation/review-owner-summary?range=30d&review=unmatched',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'wallet-adjustments-list',
    path: '/admin/wallet-adjustments?take=20',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'wallet-adjustments-summary',
    path: '/admin/wallet-adjustments/summary',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'settlement-audit-list',
    path: '/admin/booking-settlement-snapshots?range=30d&take=20',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'settlement-audit-summary',
    path: '/admin/booking-settlement-snapshots/summary?range=30d',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'settlement-reversals-list',
    path: '/admin/booking-settlement-reversals?range=30d&take=20',
    budget: { p90Ms: 1_000, maxBytes: 128 * 1024 },
  },
  {
    label: 'settlement-reversals-summary',
    path: '/admin/booking-settlement-reversals/summary?range=30d',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'partner-bank-deposits-list',
    path: '/admin/provider-wallet/deposit-requests/history?take=20&skip=0',
    budget: { p90Ms: 1_000, maxBytes: 160 * 1024 },
  },
  {
    label: 'partner-bank-deposits-review-owner-summary',
    path: '/admin/provider-wallet/deposit-requests/reconciliation-owner-summary',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'payout-batches-list',
    path: '/admin/payout-batches?range=30d&take=10&view=summary',
    budget: { p90Ms: 1_000, maxBytes: 192 * 1024 },
  },
  {
    label: 'payout-batches-summary',
    path: '/admin/payout-batches/summary?range=30d',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'partner-withdrawals-list',
    path: '/admin/provider-wallet/withdrawal-requests?range=30d&take=10',
    budget: { p90Ms: 1_000, maxBytes: 96 * 1024 },
  },
  {
    label: 'partner-withdrawals-summary',
    path: '/admin/provider-wallet/withdrawal-requests/summary?range=30d',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
];

const customerAndChatReadTargets = [
  {
    label: 'customers-list',
    path: '/admin/customers?take=20',
    budget: { p90Ms: 500, maxBytes: 64 * 1024 },
  },
  {
    label: 'customers-summary',
    path: '/admin/customers/summary',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'app-sessions-list',
    path: '/admin/app-sessions?take=20',
    budget: { p90Ms: 500, maxBytes: 64 * 1024 },
  },
  {
    label: 'app-sessions-summary',
    path: '/admin/app-sessions/summary',
    budget: { p90Ms: 750, maxBytes: 32 * 1024 },
  },
  {
    label: 'chat-archive-list',
    path: '/admin/chat-archive?dateRange=30d&take=20',
    budget: { p90Ms: 500, maxBytes: 64 * 1024 },
  },
  {
    label: 'chat-archive-summary',
    path: '/admin/chat-archive/summary?dateRange=30d',
    budget: { p90Ms: 1_000, maxBytes: 32 * 1024 },
  },
];

export function normalizeAdminApiBaseUrl(value = DEFAULT_API_BASE_URL) {
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = !pathname ? '/api' : pathname;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

export function summarizeSamples(samples) {
  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const midpoint = Math.floor(durations.length / 2);
  const medianMs = durations.length % 2 === 0
    ? (durations[midpoint - 1] + durations[midpoint]) / 2
    : durations[midpoint] ?? 0;

  return {
    bytes: Math.max(0, ...samples.map((sample) => sample.bytes)),
    medianMs,
    p90Ms: percentile(durations, 0.9),
    status: samples[0]?.status ?? 0,
  };
}

export function evaluateBudget(metric, budget) {
  const violations = [];
  if (metric.p90Ms > budget.p90Ms) {
    violations.push(`p90 ${formatMilliseconds(metric.p90Ms)} > ${budget.p90Ms}ms`);
  }
  if (metric.bytes > budget.maxBytes) {
    violations.push(`size ${formatKilobytes(metric.bytes)} > ${formatKilobytes(budget.maxBytes)}`);
  }
  return violations;
}

export function adminApiBudgetAccessToken(env, explicitToken) {
  return (
    explicitToken?.trim() ||
    env.ADMIN_API_BUDGET_ACCESS_TOKEN?.trim() ||
    env.ADMIN_ACCESS_TOKEN?.trim() ||
    ''
  );
}

export function buildReadTargets({
  bankTransactionId,
  bookingId,
  customerId,
  journalBatchId,
  partnerId,
  partnerBankDepositId,
  paymentClearingId,
  period,
  settlementReversalId,
  settlementSnapshotId,
  now = new Date(),
}) {
  const encodedBankTransactionId = encodeURIComponent(bankTransactionId);
  const encodedBookingId = encodeURIComponent(bookingId);
  const encodedCustomerId = encodeURIComponent(customerId);
  const encodedJournalBatchId = encodeURIComponent(journalBatchId);
  const encodedPartnerId = encodeURIComponent(partnerId);
  const encodedPartnerBankDepositId = encodeURIComponent(partnerBankDepositId);
  const encodedPaymentClearingId = encodeURIComponent(paymentClearingId);
  const encodedSettlementReversalId = encodeURIComponent(settlementReversalId);
  const encodedSettlementSnapshotId = encodeURIComponent(settlementSnapshotId);
  const notificationWindow = recentNotificationWindow(now);
  return [
    ...coreReadTargets,
    {
      label: 'booking-overview',
      path: `/admin/bookings/${encodedBookingId}?includeDiagnostics=false`,
      budget: { p90Ms: 750, maxBytes: 128 * 1024 },
    },
    {
      label: 'booking-diagnostics',
      path: `/admin/bookings/${encodedBookingId}?includeDiagnostics=true`,
      budget: { p90Ms: 1_000, maxBytes: 192 * 1024 },
    },
    {
      label: 'booking-notifications',
      path: `/admin/bookings/${encodedBookingId}/notifications?take=8`,
      budget: { p90Ms: 750, maxBytes: 96 * 1024 },
    },
    {
      label: 'customer-overview',
      path: `/admin/customers/${encodedCustomerId}?includeDiagnostics=false`,
      budget: { p90Ms: 750, maxBytes: 64 * 1024 },
    },
    {
      label: 'customer-diagnostics',
      path: `/admin/customers/${encodedCustomerId}?includeDiagnostics=true`,
      budget: { p90Ms: 1_000, maxBytes: 96 * 1024 },
    },
    {
      label: 'partner-overview',
      path: `/admin/partners/${encodedPartnerId}?includeDiagnostics=false`,
      budget: { p90Ms: 750, maxBytes: 64 * 1024 },
    },
    {
      label: 'partner-diagnostics',
      path: `/admin/partners/${encodedPartnerId}?includeDiagnostics=true`,
      budget: { p90Ms: 1_000, maxBytes: 96 * 1024 },
    },
    {
      label: 'finance-overview',
      path: `/admin/finance-overview?range=7d&period=${encodeURIComponent(period)}`,
      budget: { p90Ms: 1_000, maxBytes: 96 * 1024 },
    },
    ...financeReadTargets,
    {
      label: 'partner-withholding-list',
      path: `/admin/partner-withholding-tax?period=${encodeURIComponent(period)}&take=20`,
      budget: { p90Ms: 1_000, maxBytes: 64 * 1024 },
    },
    {
      label: 'partner-withholding-summary',
      path: `/admin/partner-withholding-tax/summary?period=${encodeURIComponent(period)}`,
      budget: { p90Ms: 750, maxBytes: 32 * 1024 },
    },
    {
      label: 'monthly-tax-closing-list',
      path: `/admin/monthly-tax-closings?period=${encodeURIComponent(period)}&take=20`,
      budget: { p90Ms: 750, maxBytes: 32 * 1024 },
    },
    {
      label: 'monthly-tax-closing-summary',
      path: `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(period)}`,
      budget: { p90Ms: 750, maxBytes: 32 * 1024 },
    },
    {
      label: 'payment-clearing-detail',
      path: `/admin/booking-payment-clearing/${encodedPaymentClearingId}`,
      budget: { p90Ms: 500, maxBytes: 32 * 1024 },
    },
    {
      label: 'general-ledger-detail',
      path: `/admin/accounting-journal-batches/${encodedJournalBatchId}`,
      budget: { p90Ms: 500, maxBytes: 64 * 1024 },
    },
    {
      label: 'bank-reconciliation-detail',
      path: `/admin/bank-reconciliation/${encodedBankTransactionId}`,
      budget: { p90Ms: 750, maxBytes: 96 * 1024 },
    },
    {
      label: 'settlement-audit-detail',
      path: `/admin/booking-settlement-snapshots/${encodedSettlementSnapshotId}`,
      budget: { p90Ms: 500, maxBytes: 32 * 1024 },
    },
    {
      label: 'settlement-reversal-detail',
      path: `/admin/booking-settlement-reversals/${encodedSettlementReversalId}`,
      budget: { p90Ms: 500, maxBytes: 64 * 1024 },
    },
    {
      label: 'partner-bank-deposit-detail',
      path: `/admin/provider-wallet/deposit-requests/${encodedPartnerBankDepositId}`,
      budget: { p90Ms: 750, maxBytes: 128 * 1024 },
    },
    ...customerAndChatReadTargets,
    {
      label: 'notifications-list',
      path: `/admin/notifications?take=20&${notificationWindow}`,
      budget: { p90Ms: 500, maxBytes: 64 * 1024 },
    },
    {
      label: 'notifications-summary',
      path: `/admin/notifications/summary?${notificationWindow}`,
      budget: { p90Ms: 1_000, maxBytes: 64 * 1024 },
    },
    {
      label: 'push-campaigns-list',
      path: `/admin/notifications/push-campaigns?take=20&${notificationWindow}`,
      budget: { p90Ms: 750, maxBytes: 128 * 1024 },
    },
    {
      label: 'push-campaigns-summary',
      path: `/admin/notifications/push-campaigns/summary?${notificationWindow}`,
      budget: { p90Ms: 750, maxBytes: 32 * 1024 },
    },
  ];
}

export async function runAdminApiReadBudget(options = {}) {
  const envFile = options.envFile ?? '.env';
  const { env } = loadMergedEnv(envFile);
  const token = adminApiBudgetAccessToken(env, options.token);
  if (!token) {
    throw new Error(
      'ADMIN_API_BUDGET_ACCESS_TOKEN is required. Use a current operator-scoped Admin Web API token.',
    );
  }

  const baseUrl = normalizeAdminApiBaseUrl(
    options.baseUrl ?? env.ADMIN_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  );
  const samples = positiveInteger(
    options.samples ?? env.ADMIN_API_BUDGET_SAMPLES,
    DEFAULT_SAMPLES,
    20,
  );
  const warmups = positiveInteger(
    options.warmups ?? env.ADMIN_API_BUDGET_WARMUPS,
    DEFAULT_WARMUPS,
    5,
  );
  const timeoutMs = positiveInteger(
    options.timeoutMs ?? env.ADMIN_API_BUDGET_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    30_000,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const enforceBudget = options.enforceBudget ?? false;
  const report = options.report ?? console.log;
  const common = { baseUrl, fetchImpl, timeoutMs, token };

  const bookingListTarget = coreReadTargets.find((target) => target.label === 'bookings-list');
  const customerListTarget = customerAndChatReadTargets.find(
    (target) => target.label === 'customers-list',
  );
  const partnerListTarget = coreReadTargets.find((target) => target.label === 'partners-list');
  const paymentClearingListTarget = financeReadTargets.find(
    (target) => target.label === 'payment-clearing-list',
  );
  const generalLedgerListTarget = financeReadTargets.find(
    (target) => target.label === 'general-ledger-list',
  );
  const bankReconciliationListTarget = financeReadTargets.find(
    (target) => target.label === 'bank-reconciliation-list',
  );
  const settlementAuditListTarget = financeReadTargets.find(
    (target) => target.label === 'settlement-audit-list',
  );
  const settlementReversalsListTarget = financeReadTargets.find(
    (target) => target.label === 'settlement-reversals-list',
  );
  const partnerBankDepositsListTarget = financeReadTargets.find(
    (target) => target.label === 'partner-bank-deposits-list',
  );
  const [
    bookingList,
    customerList,
    partnerList,
    paymentClearingList,
    generalLedgerList,
    bankReconciliationList,
    settlementAuditList,
    settlementReversalsList,
    partnerBankDepositsList,
  ] = await Promise.all([
    requestAdminJson(bookingListTarget.path, common),
    requestAdminJson(customerListTarget.path, common),
    requestAdminJson(partnerListTarget.path, common),
    requestAdminJson(paymentClearingListTarget.path, common),
    requestAdminJson(generalLedgerListTarget.path, common),
    requestAdminJson(bankReconciliationListTarget.path, common),
    requestAdminJson(settlementAuditListTarget.path, common),
    requestAdminJson(settlementReversalsListTarget.path, common),
    requestAdminJson(partnerBankDepositsListTarget.path, common),
  ]);
  const bookingId =
    options.bookingId ?? env.ADMIN_API_BUDGET_BOOKING_ID ?? firstArrayRowId(bookingList.body);
  if (!bookingId) {
    throw new Error('No booking is available for Admin API detail budget checks.');
  }
  const customerId =
    options.customerId ?? env.ADMIN_API_BUDGET_CUSTOMER_ID ?? firstArrayRowId(customerList.body);
  if (!customerId) {
    throw new Error('No customer is available for Admin API detail budget checks.');
  }
  const partnerId =
    options.partnerId ?? env.ADMIN_API_BUDGET_PARTNER_ID ?? firstArrayRowId(partnerList.body);
  if (!partnerId) {
    throw new Error('No Partner is available for Admin API detail budget checks.');
  }
  const paymentClearingId =
    options.paymentClearingId ??
    env.ADMIN_API_BUDGET_PAYMENT_CLEARING_ID ??
    firstArrayRowId(paymentClearingList.body);
  if (!paymentClearingId) {
    throw new Error('No payment clearing row is available for Admin API detail budget checks.');
  }
  const journalBatchId =
    options.journalBatchId ??
    env.ADMIN_API_BUDGET_JOURNAL_BATCH_ID ??
    firstArrayRowId(generalLedgerList.body);
  if (!journalBatchId) {
    throw new Error('No journal batch is available for Admin API detail budget checks.');
  }
  const bankTransactionId =
    options.bankTransactionId ??
    env.ADMIN_API_BUDGET_BANK_TRANSACTION_ID ??
    firstArrayRowId(bankReconciliationList.body);
  if (!bankTransactionId) {
    throw new Error('No bank transaction is available for Admin API detail budget checks.');
  }
  const settlementSnapshotId =
    options.settlementSnapshotId ??
    env.ADMIN_API_BUDGET_SETTLEMENT_SNAPSHOT_ID ??
    firstArrayRowId(settlementAuditList.body);
  if (!settlementSnapshotId) {
    throw new Error('No settlement snapshot is available for Admin API detail budget checks.');
  }
  const settlementReversalId =
    options.settlementReversalId ??
    env.ADMIN_API_BUDGET_SETTLEMENT_REVERSAL_ID ??
    firstArrayRowId(settlementReversalsList.body);
  if (!settlementReversalId) {
    throw new Error('No settlement reversal is available for Admin API detail budget checks.');
  }
  const partnerBankDepositId =
    options.partnerBankDepositId ??
    env.ADMIN_API_BUDGET_PARTNER_BANK_DEPOSIT_ID ??
    firstHistoryItemId(partnerBankDepositsList.body);
  if (!partnerBankDepositId) {
    throw new Error('No Partner bank deposit is available for Admin API detail budget checks.');
  }

  const period = options.period ?? env.ADMIN_API_BUDGET_PERIOD ?? new Date().toISOString().slice(0, 7);
  const targets = buildReadTargets({
    bankTransactionId,
    bookingId,
    customerId,
    journalBatchId,
    partnerId,
    partnerBankDepositId,
    paymentClearingId,
    period,
    settlementReversalId,
    settlementSnapshotId,
  });

  const failures = [];
  const metrics = [];
  for (const target of targets) {
    for (let index = 0; index < warmups; index += 1) {
      await requestAdminJson(target.path, common);
    }

    const targetSamples = [];
    for (let index = 0; index < samples; index += 1) {
      const response = await requestAdminJson(target.path, common);
      targetSamples.push(response);
    }

    const metric = { label: target.label, ...summarizeSamples(targetSamples) };
    const violations = evaluateBudget(metric, target.budget);
    metrics.push(metric);
    if (violations.length > 0) failures.push({ label: target.label, violations });

    const state = violations.length > 0 ? 'WARN' : 'PASS';
    report(
      `${state} ${target.label} status=${metric.status} median=${formatMilliseconds(metric.medianMs)} ` +
        `p90=${formatMilliseconds(metric.p90Ms)} size=${formatKilobytes(metric.bytes)} ` +
        `budget=${target.budget.p90Ms}ms/${formatKilobytes(target.budget.maxBytes)}`,
    );
  }

  if (enforceBudget && failures.length > 0) {
    throw new Error(
      `Admin API read budget exceeded: ${failures
        .map((failure) => `${failure.label} (${failure.violations.join(', ')})`)
        .join('; ')}`,
    );
  }

  return { failures, metrics };
}

async function requestAdminJson(path, { baseUrl, fetchImpl, timeoutMs, token }) {
  const startedAt = performance.now();
  const response = await fetchImpl(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bodyText = await response.text();
  const result = {
    body: parseJson(bodyText),
    bytes: Buffer.byteLength(bodyText, 'utf8'),
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    status: response.status,
  };
  if (response.status !== 200) {
    throw new Error(`Admin API read smoke received HTTP ${response.status}.`);
  }
  return result;
}

function firstArrayRowId(body) {
  if (!Array.isArray(body)) return null;
  const id = body.find((row) => row && typeof row === 'object' && typeof row.id === 'string')?.id;
  return id?.trim() || null;
}

function firstHistoryItemId(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return null;
  return firstArrayRowId(body.items);
}

function parseJson(source) {
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    throw new Error('Admin API read smoke received a non-JSON response.');
  }
}

function recentNotificationWindow(now) {
  const to = new Date(now);
  if (Number.isNaN(to.getTime())) {
    throw new Error('Admin API read budget requires a valid measurement timestamp.');
  }
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1_000);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();
}

function formatMilliseconds(value) {
  return `${Math.round(value * 10) / 10}ms`;
}

function formatKilobytes(value) {
  return `${Math.ceil(value / 1024)}KB`;
}

function readCliOptions(args) {
  return {
    enforceBudget: args.includes('--enforce-budget'),
    envFile: args.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env',
    samples: args.find((arg) => arg.startsWith('--samples='))?.slice('--samples='.length),
    warmups: args.find((arg) => arg.startsWith('--warmups='))?.slice('--warmups='.length),
  };
}

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  runAdminApiReadBudget(readCliOptions(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
