import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminApiBudgetAccessToken,
  buildReadTargets,
  evaluateBudget,
  normalizeAdminApiBaseUrl,
  percentile,
  positiveInteger,
  summarizeSamples,
} from './admin-api-read-budget.mjs';
import {
  buildFinanceOverviewDurationReport,
  parseFinanceOverviewDurationEvents,
} from './finance-overview-summary-duration-report.mjs';

test('prefers an explicit or operator-scoped budget token over the legacy maintenance token', () => {
  const env = {
    ADMIN_ACCESS_TOKEN: 'legacy-maintenance-token',
    ADMIN_API_BUDGET_ACCESS_TOKEN: 'operator-scoped-token',
  };

  assert.equal(adminApiBudgetAccessToken(env), 'operator-scoped-token');
  assert.equal(adminApiBudgetAccessToken(env, 'explicit-token'), 'explicit-token');
  assert.equal(adminApiBudgetAccessToken({ ADMIN_ACCESS_TOKEN: 'legacy-maintenance-token' }), 'legacy-maintenance-token');
});

test('covers bounded core, Finance, Partner, customer, chat and notification read models', () => {
  const targets = buildReadTargets({
    bankTransactionId: 'bank/id with spaces',
    bookingId: 'booking/id with spaces',
    customerId: 'customer/id with spaces',
    journalBatchId: 'journal/id with spaces',
    partnerId: 'partner/id with spaces',
    partnerBankDepositId: 'deposit/id with spaces',
    paymentClearingId: 'clearing/id with spaces',
    period: '2026-07',
    settlementReversalId: 'reversal/id with spaces',
    settlementSnapshotId: 'snapshot/id with spaces',
    now: new Date('2026-07-16T12:00:00.000Z'),
  });
  const labels = new Set(targets.map((target) => target.label));

  for (const label of [
    'partners-list',
    'partner-analytics-overview',
    'services-operational',
    'bookings-list',
    'start-shift-summary',
    'finance-overview',
    'payment-clearing-list',
    'payment-clearing-review-owner-summary',
    'payment-clearing-48h-list',
    'payment-clearing-48h-summary',
    'payment-clearing-48h-review-owner-summary',
    'payment-clearing-detail',
    'general-ledger-list',
    'general-ledger-detail',
    'bank-reconciliation-list',
    'bank-reconciliation-detail',
    'bank-reconciliation-review-owner-summary',
    'wallet-adjustments-list',
    'settlement-audit-list',
    'settlement-audit-detail',
    'settlement-reversals-list',
    'settlement-reversal-detail',
    'partner-bank-deposits-list',
    'partner-bank-deposits-review-owner-summary',
    'partner-bank-deposit-detail',
    'payout-batches-list',
    'payout-batches-summary',
    'partner-withdrawals-list',
    'partner-withdrawals-summary',
    'partner-withholding-list',
    'partner-withholding-summary',
    'monthly-tax-closing-list',
    'monthly-tax-closing-summary',
    'customers-list',
    'customer-overview',
    'customer-diagnostics',
    'partner-overview',
    'partner-diagnostics',
    'app-sessions-list',
    'chat-archive-list',
    'notifications-list',
    'push-campaigns-list',
  ]) {
    assert.equal(labels.has(label), true, `${label} must remain in the read budget manifest`);
  }

  assert.equal(
    targets.find((target) => target.label === 'partner-analytics-overview')?.path,
    '/admin/partners/overview?range=7d&includeActionRows=false&previewLimit=5',
  );
  assert.equal(
    targets.find((target) => target.label === 'services-operational')?.path,
    '/admin/services?scope=operational',
  );
  assert.equal(
    targets.find((target) => target.label === 'booking-overview')?.path,
    '/admin/bookings/booking%2Fid%20with%20spaces?includeDiagnostics=false',
  );
  assert.equal(
    targets.find((target) => target.label === 'customer-overview')?.path,
    '/admin/customers/customer%2Fid%20with%20spaces?includeDiagnostics=false',
  );
  assert.equal(
    targets.find((target) => target.label === 'customer-diagnostics')?.path,
    '/admin/customers/customer%2Fid%20with%20spaces?includeDiagnostics=true',
  );
  assert.equal(
    targets.find((target) => target.label === 'partner-overview')?.path,
    '/admin/partners/partner%2Fid%20with%20spaces?includeDiagnostics=false',
  );
  assert.equal(
    targets.find((target) => target.label === 'partner-diagnostics')?.path,
    '/admin/partners/partner%2Fid%20with%20spaces?includeDiagnostics=true',
  );
  assert.equal(
    targets.find((target) => target.label === 'payment-clearing-detail')?.path,
    '/admin/booking-payment-clearing/clearing%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'payment-clearing-48h-list')?.path,
    '/admin/booking-payment-clearing?take=20&range=all&review=open&age=48h',
  );
  assert.equal(
    targets.find((target) => target.label === 'payment-clearing-48h-summary')?.path,
    '/admin/booking-payment-clearing/summary?range=all&review=open&age=48h',
  );
  assert.equal(
    targets.find((target) => target.label === 'payment-clearing-48h-review-owner-summary')?.path,
    '/admin/booking-payment-clearing/review-owner-summary?range=all&review=open&age=48h',
  );
  assert.equal(
    targets.find((target) => target.label === 'general-ledger-detail')?.path,
    '/admin/accounting-journal-batches/journal%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'bank-reconciliation-detail')?.path,
    '/admin/bank-reconciliation/bank%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'settlement-audit-detail')?.path,
    '/admin/booking-settlement-snapshots/snapshot%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'settlement-reversal-detail')?.path,
    '/admin/booking-settlement-reversals/reversal%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'partner-bank-deposit-detail')?.path,
    '/admin/provider-wallet/deposit-requests/deposit%2Fid%20with%20spaces',
  );
  assert.equal(
    targets.find((target) => target.label === 'partner-withholding-list')?.path,
    '/admin/partner-withholding-tax?period=2026-07&take=20',
  );
  assert.equal(
    targets.find((target) => target.label === 'monthly-tax-closing-summary')?.path,
    '/admin/monthly-tax-closings/summary?period=2026-07',
  );
  for (const target of targets.filter((item) => item.label.endsWith('-list'))) {
    assert.match(target.path, /[?&]take=\d+/);
  }
  assert.equal(
    targets.find((target) => target.label === 'notifications-list')?.path,
    '/admin/notifications?take=20&from=2026-07-15T12%3A00%3A00.000Z&to=2026-07-16T12%3A00%3A00.000Z',
  );
  assert.deepEqual(targets.find((target) => target.label === 'partners-list')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'chat-archive-list')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'customers-list')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'partner-overview')?.budget, {
    p90Ms: 750,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'partner-diagnostics')?.budget, {
    p90Ms: 1_000,
    maxBytes: 96 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'payment-clearing-detail')?.budget, {
    p90Ms: 500,
    maxBytes: 32 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'payment-clearing-48h-list')?.budget, {
    p90Ms: 1_000,
    maxBytes: 160 * 1024,
  });
  assert.deepEqual(
    targets.find((target) => target.label === 'payment-clearing-48h-summary')?.budget,
    {
      p90Ms: 750,
      maxBytes: 32 * 1024,
    },
  );
  assert.deepEqual(
    targets.find((target) => target.label === 'payment-clearing-48h-review-owner-summary')?.budget,
    {
      p90Ms: 750,
      maxBytes: 32 * 1024,
    },
  );
  assert.deepEqual(
    targets.find((target) => target.label === 'payment-clearing-review-owner-summary')?.budget,
    {
      p90Ms: 750,
      maxBytes: 32 * 1024,
    },
  );
  assert.deepEqual(targets.find((target) => target.label === 'general-ledger-detail')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'bank-reconciliation-detail')?.budget, {
    p90Ms: 750,
    maxBytes: 96 * 1024,
  });
  assert.deepEqual(
    targets.find((target) => target.label === 'bank-reconciliation-review-owner-summary')?.budget,
    {
      p90Ms: 750,
      maxBytes: 32 * 1024,
    },
  );
  assert.deepEqual(targets.find((target) => target.label === 'settlement-audit-detail')?.budget, {
    p90Ms: 500,
    maxBytes: 32 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'settlement-reversal-detail')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'partner-bank-deposit-detail')?.budget, {
    p90Ms: 750,
    maxBytes: 128 * 1024,
  });
  assert.deepEqual(
    targets.find((target) => target.label === 'partner-bank-deposits-review-owner-summary')?.budget,
    {
      p90Ms: 750,
      maxBytes: 32 * 1024,
    },
  );
  assert.deepEqual(targets.find((target) => target.label === 'payout-batches-list')?.budget, {
    p90Ms: 1_000,
    maxBytes: 192 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'partner-withdrawals-list')?.budget, {
    p90Ms: 1_000,
    maxBytes: 96 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'partner-withholding-list')?.budget, {
    p90Ms: 1_000,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'monthly-tax-closing-summary')?.budget, {
    p90Ms: 750,
    maxBytes: 32 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'app-sessions-list')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
  assert.deepEqual(targets.find((target) => target.label === 'notifications-list')?.budget, {
    p90Ms: 500,
    maxBytes: 64 * 1024,
  });
});

test('normalizes the Admin API base URL without retaining query data', () => {
  assert.equal(normalizeAdminApiBaseUrl('http://localhost:3000'), 'http://localhost:3000/api');
  assert.equal(normalizeAdminApiBaseUrl('http://localhost:3000/api/'), 'http://localhost:3000/api');
  assert.equal(
    normalizeAdminApiBaseUrl('https://api.example.com/internal/api?token=removed#fragment'),
    'https://api.example.com/internal/api',
  );
});

test('bounds sample configuration and calculates stable percentiles', () => {
  assert.equal(positiveInteger('7', 5, 10), 7);
  assert.equal(positiveInteger('0', 5, 10), 5);
  assert.equal(positiveInteger('50', 5, 10), 10);
  assert.equal(percentile([50, 10, 40, 20, 30], 0.9), 50);
  assert.equal(percentile([], 0.9), 0);
});

test('summarizes response samples without retaining response bodies', () => {
  assert.deepEqual(
    summarizeSamples([
      { status: 200, bytes: 1024, durationMs: 30 },
      { status: 200, bytes: 2048, durationMs: 10 },
      { status: 200, bytes: 1536, durationMs: 20 },
    ]),
    { status: 200, bytes: 2048, medianMs: 20, p90Ms: 30 },
  );
});

test('reports latency and payload violations independently', () => {
  assert.deepEqual(
    evaluateBudget(
      { status: 200, medianMs: 400, p90Ms: 800, bytes: 120 * 1024 },
      { p90Ms: 750, maxBytes: 96 * 1024 },
    ),
    ['p90 800ms > 750ms', 'size 120KB > 96KB'],
  );
  assert.deepEqual(
    evaluateBudget(
      { status: 200, medianMs: 50, p90Ms: 75, bytes: 10 * 1024 },
      { p90Ms: 750, maxBytes: 96 * 1024 },
    ),
    [],
  );
});

test('parses raw and wrapped Finance Overview duration logs without retaining unrelated lines', () => {
  const event = {
    event: 'finance_overview_summary_duration',
    status: 'ok',
    range: '30d',
    period: '2026-07',
    durationMs: 800,
    summaryDurationMs: { paymentSummary: 120 },
    paymentSummaryPhaseDurationMs: { aggregateAndCountMs: 90, ageAndSlaMs: 30, durationMs: 120 },
  };
  const events = parseFinanceOverviewDurationEvents(
    [
      'unrelated output',
      JSON.stringify(event),
      JSON.stringify({ message: JSON.stringify({ ...event, durationMs: 900 }) }),
      '{"event":"finance_overview_summary_duration","status":"bad"}',
    ].join('\n'),
  );

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((item) => item.durationMs), [800, 900]);
  assert.deepEqual(events[0]?.paymentSummaryPhaseDurationMs, {
    aggregateAndCountMs: 90,
    ageAndSlaMs: 30,
    durationMs: 120,
  });
});

test('reports scope-specific Finance Overview p50 and p95 only after enough successful samples', () => {
  const events = [
    ...Array.from({ length: 20 }, (_, index) => ({
      event: 'finance_overview_summary_duration',
      status: 'ok',
      range: '30d',
      period: '2026-07',
      durationMs: 100 + index,
      summaryDurationMs: { slowSummary: 50 + index, fastSummary: 20 },
      paymentSummaryPhaseDurationMs: {
        aggregateAndCountMs: 40 + index,
        ageAndSlaMs: 10,
        durationMs: 50 + index,
      },
    })),
    {
      event: 'finance_overview_summary_duration',
      status: 'ok',
      range: 'today',
      period: '2026-08',
      durationMs: 80,
      summaryDurationMs: { slowSummary: 40 },
    },
  ];

  const report = buildFinanceOverviewDurationReport(events);
  const thirtyDay = report.scopes.find((scope) => scope.range === '30d');
  const today = report.scopes.find((scope) => scope.range === 'today');

  assert.equal(thirtyDay?.decision, 'READY_FOR_PERFORMANCE_REVIEW');
  assert.deepEqual(thirtyDay?.durationMs, { samples: 20, p50Ms: 109, p95Ms: 118, maxMs: 119 });
  assert.deepEqual(thirtyDay?.summaries.map((summary) => summary.name), ['slowSummary', 'fastSummary']);
  assert.deepEqual(thirtyDay?.paymentSummaryPhases.map((phase) => phase.name), [
    'durationMs',
    'aggregateAndCountMs',
    'ageAndSlaMs',
  ]);
  assert.equal(today?.decision, 'INSUFFICIENT_SAMPLES');
});
