import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReadTargets,
  evaluateBudget,
  normalizeAdminApiBaseUrl,
  percentile,
  positiveInteger,
  summarizeSamples,
} from './admin-api-read-budget.mjs';

test('covers bounded core, Finance, customer, chat and notification read models', () => {
  const targets = buildReadTargets('booking/id with spaces', '2026-07', new Date('2026-07-16T12:00:00.000Z'));
  const labels = new Set(targets.map((target) => target.label));

  for (const label of [
    'partners-list',
    'bookings-list',
    'finance-overview',
    'payment-clearing-list',
    'general-ledger-list',
    'bank-reconciliation-list',
    'wallet-adjustments-list',
    'customers-list',
    'app-sessions-list',
    'chat-archive-list',
    'notifications-list',
    'push-campaigns-list',
  ]) {
    assert.equal(labels.has(label), true, `${label} must remain in the read budget manifest`);
  }

  assert.equal(
    targets.find((target) => target.label === 'booking-overview')?.path,
    '/admin/bookings/booking%2Fid%20with%20spaces?includeDiagnostics=false',
  );
  for (const target of targets.filter((item) => item.label.endsWith('-list'))) {
    assert.match(target.path, /[?&]take=\d+/);
  }
  assert.equal(
    targets.find((target) => target.label === 'notifications-list')?.path,
    '/admin/notifications?take=20&from=2026-07-15T12%3A00%3A00.000Z&to=2026-07-16T12%3A00%3A00.000Z',
  );
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
