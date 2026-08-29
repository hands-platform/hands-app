import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./api-smoke.mjs', import.meta.url), 'utf8');
const realtimeSource = await readFile(new URL('./realtime-smoke.mjs', import.meta.url), 'utf8');

test('API smoke uses the current Admin Web session token contract', () => {
  assert.match(source, /prisma\.adminOperatorCredential\.upsert/);
  assert.match(source, /prisma\.adminOperatorPermission\.upsert/);
  assert.match(source, /prisma\.adminWebSession\.create/);
  assert.match(source, /typ:\s*'admin-web-api'/);
  assert.match(source, /aud:\s*'hands-api'/);
  assert.match(source, /scope:\s*'admin:api'/);
});

test('API smoke preserves append-only journals and isolates repeat runs', () => {
  assert.doesNotMatch(source, /accountingJournalBatch\.deleteMany/);
  assert.match(source, /apiSmokePastPeriod/);
  assert.match(source, /invalid-posted-journal:\$\{apiSmokeRunId\}/);
  assert.match(source, /settlement-snapshot:\$\{apiSmokeRunId\}/);
});

test('API smoke distinguishes policy presence from live enforcement', () => {
  assert.match(source, /requiredPolicyKeys/);
  assert.match(source, /requiredEnforcedPolicyKeys/);
  assert.match(source, /'matching\.preferred_accept_mode'/);
  assert.match(source, /'Locked first-pick policy rejects edits'/);
  assert.match(source, /'Locked marketplace open mode rejects edits'/);
  assert.match(source, /'Planned after-match cancellation policy rejects edits'/);
  assert.match(source, /OPERATIONAL_POLICY_NOT_EDITABLE/);
  assert.doesNotMatch(source, /legacyDelayedMarketplaceBooking/);
  assert.match(source, /policySetting\?\.risk === 'high'/);
  assert.match(source, /confirmationLabel: policySetting\.label/);
});

test('API smoke uses production-provenance Finance governance only inside its disposable target', () => {
  assert.match(source, /financeApproverSmokeAttestationEvents/);
  assert.match(source, /AdminUserProvenance\.PRODUCTION/);
  assert.match(source, /attestSmokeFinanceApprovers/);
  assert.match(source, /disposable-api-smoke:/);
});

test('Realtime smoke uses a disposable current-contract Admin Web session', () => {
  assert.match(realtimeSource, /assertTaxPolicyFixtureWriteTarget/);
  assert.match(realtimeSource, /AdminUserProvenance\.FIXTURE/);
  assert.match(realtimeSource, /fixtureKind:\s*'REALTIME_SMOKE'/);
  assert.match(realtimeSource, /prisma\.adminWebSession\.create/);
  assert.match(realtimeSource, /prisma\.adminOperatorPermission\.create/);
  assert.match(realtimeSource, /prisma\.adminOperatorCredential\.create/);
  assert.match(realtimeSource, /typ:\s*'admin-web-api'/);
  assert.match(realtimeSource, /scope:\s*'admin:api'/);
  assert.match(realtimeSource, /Realtime smoke prepares an approved disposable Partner fixture\./);
  assert.match(realtimeSource, /'booking\.cancelled'/);
});
