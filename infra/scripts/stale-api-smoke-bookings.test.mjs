import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  createApiSmokeBookingTracker,
  installApiSmokeProcessFailureHandlers,
  isLegacyApiSmokeCustomer,
  isStaleApiSmokeAddress,
  summarizeStaleApiSmokeBookings,
} from './lib/stale-api-smoke-bookings.mjs';

test('booking tracker records only successful customer booking responses', () => {
  const tracker = createApiSmokeBookingTracker();

  assert.equal(tracker.record('/customer/bookings', { id: 'booking-1' }), true);
  assert.equal(tracker.record('/customer/bookings', { id: 'booking-1' }), true);
  assert.equal(tracker.record('/customer/bookings', {}), false);
  assert.equal(tracker.record('/admin/bookings', { id: 'booking-2' }), false);
  assert.deepEqual(tracker.snapshot(), ['booking-1']);
  assert.equal(tracker.has('booking-1'), true);
  assert.equal(tracker.has('booking-2'), false);
});

test('process failure handler cleans once and preserves the original failure', async () => {
  const processTarget = new EventEmitter();
  const reports = [];
  const exits = [];
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });
  let cleanupCalls = 0;

  installApiSmokeProcessFailureHandlers({
    cleanup: async (origin) => {
      cleanupCalls += 1;
      return { expired: 2, origin };
    },
    exit: (code) => {
      exits.push(code);
      resolveExit();
    },
    processTarget,
    report: (payload) => reports.push(payload),
  });

  processTarget.emit('unhandledRejection', new Error('planned smoke failure'));
  processTarget.emit('SIGTERM');
  await exited;

  assert.equal(cleanupCalls, 1);
  assert.deepEqual(exits, [1]);
  assert.deepEqual(reports, [
    {
      cleanup: { expired: 2, origin: 'unhandledRejection' },
      cleanupError: undefined,
      error: 'planned smoke failure',
      ok: false,
      origin: 'unhandledRejection',
    },
  ]);
});

test('process failure handler reports cleanup failure before exiting', async () => {
  const processTarget = new EventEmitter();
  let reported;
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });

  installApiSmokeProcessFailureHandlers({
    cleanup: async () => {
      throw new Error('cleanup failed');
    },
    exit: (code) => resolveExit(code),
    processTarget,
    report: (payload) => {
      reported = payload;
    },
  });

  processTarget.emit('SIGINT');
  const exitCode = await exited;

  assert.equal(exitCode, 130);
  assert.equal(reported.cleanup, undefined);
  assert.equal(reported.cleanupError, 'cleanup failed');
  assert.equal(reported.error, 'API smoke interrupted');
  assert.equal(reported.origin, 'SIGINT');
});

test('only explicit API and realtime smoke address markers qualify', () => {
  assert.equal(isStaleApiSmokeAddress('Hybrid fallback smoke flow'), true);
  assert.equal(isStaleApiSmokeAddress('Realtime smoke 1779364584575'), true);
  assert.equal(isStaleApiSmokeAddress('  Negative wallet service start smoke flow  '), true);
  assert.equal(isStaleApiSmokeAddress('Customer asked for a smoke-free room'), false);
  assert.equal(isStaleApiSmokeAddress('District 1, Ho Chi Minh City'), false);
  assert.equal(isStaleApiSmokeAddress(null), false);
});

test('legacy API smoke customer requires both the exact name and configured phone', () => {
  assert.equal(
    isLegacyApiSmokeCustomer(
      { fullName: 'Demo Customer', phone: '+84900000001' },
      '+84900000001',
    ),
    true,
  );
  assert.equal(
    isLegacyApiSmokeCustomer(
      { fullName: 'Demo Customer', phone: '+84900000002' },
      '+84900000001',
    ),
    false,
  );
  assert.equal(
    isLegacyApiSmokeCustomer(
      { fullName: 'Real Customer', phone: '+84900000001' },
      '+84900000001',
    ),
    false,
  );
});

test('summary groups candidates without exposing booking identifiers', () => {
  const summary = summarizeStaleApiSmokeBookings([
    {
      id: 'booking-private-1',
      selectedProviderId: 'provider-1',
      status: 'MATCHED',
      cleanupSource: 'explicit_smoke_address',
      addressSnapshot: { addressText: 'Hybrid fallback smoke flow' },
    },
    {
      id: 'booking-private-2',
      selectedProviderId: 'provider-1',
      status: 'IN_SERVICE',
      cleanupSource: 'explicit_smoke_address',
      addressSnapshot: { addressText: 'Hybrid fallback smoke flow' },
    },
    {
      id: 'booking-private-3',
      selectedProviderId: 'provider-2',
      status: 'MATCHED',
      cleanupSource: 'legacy_demo_customer',
      addressSnapshot: { addressText: 'Realtime smoke 123' },
    },
  ]);

  assert.deepEqual(summary, {
    addresses: [
      { count: 2, label: 'Hybrid fallback smoke flow' },
      { count: 1, label: 'Realtime smoke 123' },
    ],
    affectedProviderCount: 2,
    sources: [
      { count: 2, label: 'explicit_smoke_address' },
      { count: 1, label: 'legacy_demo_customer' },
    ],
    statuses: [
      { count: 2, label: 'MATCHED' },
      { count: 1, label: 'IN_SERVICE' },
    ],
    total: 3,
  });
  assert.equal(JSON.stringify(summary).includes('booking-private'), false);
});
