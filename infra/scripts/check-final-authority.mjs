import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const violations = [];

checkRequiredAuthorityDoc();
checkOnDemandBookingContract();
checkCustomerFinalSelectionContract();
checkSupabaseBoundary();
checkMobileVisibleCopyGuardIsStrict();

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      purpose:
        'Static HANDS MVP final authority guard: NestJS business authority, on-demand booking, customer final selection, no tip flow, and Partner visible copy.',
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  process.exitCode = 1;
}

function checkRequiredAuthorityDoc() {
  const source = read('docs/architecture/hands-mvp-final-authority.md');
  requireMarkers('docs/architecture/hands-mvp-final-authority.md', source, [
    'Supabase is infrastructure. NestJS owns business rules',
    'Every booking must preserve an immutable `BookingAddressSnapshot`',
    'Preferred partner gets the first-pick window, currently 10 minutes',
    'default 10km, can join during the matching window',
    'The customer always chooses the final partner',
    'There is no automatic partner assignment',
    'Do not expose scheduled booking or calendar booking UX',
    'Tips are not part of the MVP',
    'customers do not directly cancel through a normal cancel button',
    'Negative partner wallet balances allow visibility and join intent',
    'Partner payouts are weekly, monthly, or admin-selected batch cycles',
    'Admin is an Operations Command Center',
    'visible product copy should use `Partner`',
  ]);
}

function checkOnDemandBookingContract() {
  const controller = read('apps/api/src/bookings/bookings.controller.ts');
  const service = read('apps/api/src/bookings/bookings.service.ts');
  const smoke = read('infra/scripts/api-smoke.mjs');

  rejectMarker('apps/api/src/bookings/bookings.controller.ts', controller, 'scheduledStartAt?:');
  rejectMarker('apps/api/src/bookings/bookings.service.ts', service, 'scheduledStartAt?:');
  requireMarkers('apps/api/src/bookings/bookings.service.ts', service, [
    'HANDS MVP is on-demand only',
    'const scheduledStartAt = new Date();',
  ]);
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    'Customer-supplied scheduledStartAt should not create scheduled booking',
    'ignoredFutureScheduledStartAt',
  ]);
}

function checkCustomerFinalSelectionContract() {
  const policy = read('apps/api/src/matching/matching.policy.ts');
  const bookings = read('apps/api/src/bookings/bookings.service.ts');
  const smoke = read('infra/scripts/api-smoke.mjs');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');

  rejectMarker('apps/api/src/matching/matching.policy.ts', policy, 'AUTO_MATCH_ON_ACCEPT');
  requireMarkers('apps/api/src/matching/matching.policy.ts', policy, [
    "export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';",
    'return PREFERRED_ACCEPT_CUSTOMER_CONFIRM;',
    'Automatic matching is disabled for the MVP.',
  ]);
  requireMarkers('apps/api/src/bookings/bookings.service.ts', bookings, [
    "type: 'provider.accepted'",
    'Confirm this partner or choose another available partner.',
    'selectedProviderId: null',
    'The customer selected you for this booking.',
  ]);
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    'Customer final confirmation did not match preferred accepted partner',
    'acceptedButWaiting.status !==',
    'selectedProviderId !== null',
  ]);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, [
    'Stage 3 choice',
    'Customer Choice',
    'legacy Provider wording',
  ]);
}

function checkSupabaseBoundary() {
  const allowedFlutterSupabaseFiles = new Set([
    normalize('apps/customer_app/lib/src/core/supabase_client_provider.dart'),
    normalize(
      'apps/customer_app/lib/src/features/auth/data/datasources/supabase_otp_auth_remote_datasource.dart',
    ),
    normalize('apps/customer_app/lib/src/features/auth/data/models/auth_session_model.dart'),
    normalize('apps/customer_app/lib/src/features/auth/presentation/providers/auth_providers.dart'),
    normalize('apps/provider_app/lib/src/core/supabase_client_provider.dart'),
    normalize(
      'apps/provider_app/lib/src/features/auth/data/datasources/supabase_otp_auth_remote_datasource.dart',
    ),
    normalize('apps/provider_app/lib/src/features/auth/data/models/auth_session_model.dart'),
    normalize('apps/provider_app/lib/src/features/auth/presentation/providers/auth_providers.dart'),
  ]);

  for (const file of [
    ...listFiles('apps/customer_app/lib', '.dart'),
    ...listFiles('apps/provider_app/lib', '.dart'),
  ]) {
    const source = read(file);
    if (!source.includes('supabase_flutter') && !source.includes('SupabaseClient')) {
      continue;
    }
    if (!allowedFlutterSupabaseFiles.has(normalize(file))) {
      fail(
        file,
        'Flutter Supabase usage must stay behind auth/core datasource boundaries and not inside screens/business features.',
      );
    }
  }

  for (const file of [
    ...listFiles('apps/customer_app/lib', '.dart'),
    ...listFiles('apps/provider_app/lib', '.dart'),
  ]) {
    const source = read(file);
    if (/\b_client\.(from|rpc|storage)\b/.test(source) || /\bSupabase\.instance\b/.test(source)) {
      fail(
        file,
        'Mobile app must not query Supabase business tables directly; call NestJS repositories/usecases instead.',
      );
    }
  }
}

function checkMobileVisibleCopyGuardIsStrict() {
  const source = read('infra/scripts/check-mobile-visible-copy.mjs');
  requireMarkers('infra/scripts/check-mobile-visible-copy.mjs', source, [
    'legacy provider display wording',
    'legacy backup wording',
    'tip wording',
    'people scoring wording',
    'partner hierarchy wording',
  ]);
}

function requireMarkers(file, source, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      fail(file, `Missing required authority marker: ${marker}`);
    }
  }
}

function rejectMarker(file, source, marker) {
  if (source.includes(marker)) {
    fail(file, `Forbidden authority marker is present: ${marker}`);
  }
}

function fail(file, message) {
  violations.push({ file, message });
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function listFiles(dir, extension) {
  const absoluteDir = resolve(root, dir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry);
    const relativePath = normalize(absolutePath.slice(root.length + 1));
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      return listFiles(relativePath, extension);
    }
    return relativePath.endsWith(extension) ? [relativePath] : [];
  });
}
