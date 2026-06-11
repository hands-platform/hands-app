import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const violations = [];

checkAdminServicePushDeviceSelects();
checkAdminApiTypes();
checkAdminUiTokenAccess();
checkAdminPaymentPayloadRedaction();
checkAdminNotificationBodies();

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      purpose:
        'Static security guard for Admin API and Admin Web sensitive field exposure, especially FCM/push tokens.',
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  process.exitCode = 1;
}

function checkAdminServicePushDeviceSelects() {
  const file = 'apps/api/src/admin/admin.service.ts';
  const userSelectsFile = 'apps/api/src/admin/admin-user-selects.ts';
  const source = read(file);
  const userSelectsSource = read(userSelectsFile);

  reject(file, source, 'token: true', 'AdminService must not select push device tokens.');
  reject(userSelectsFile, userSelectsSource, 'token: true', 'Admin user selects must not expose push device tokens.');

  for (const block of relationObjectBlocks(source, 'pushDevices')) {
    if (!block.content.includes('include:')) {
      continue;
    }
    fail(
      file,
      'AdminService pushDevices relation must use an explicit safe select. Prisma include would expose scalar token fields.',
      block.index,
    );
  }

  const safeSelect = sliceBetween(
    userSelectsSource,
    'const adminPushDeviceSummarySelect = {',
    '} satisfies Prisma.PushDeviceSelect;',
  );
  if (!safeSelect || !safeSelect.includes('deliveries:') || safeSelect.includes('token')) {
    fail(userSelectsFile, 'adminPushDeviceSummarySelect must include delivery health but never the raw token.');
  }
}

function checkAdminApiTypes() {
  const file = 'apps/admin_web/lib/admin-api.ts';
  const source = read(file);

  for (const match of source.matchAll(/pushDevices\??:\s*Array<\{[\s\S]{0,800}?token\s*[?:]/g)) {
    fail(file, 'Admin API pushDevices type must not expose a raw token field.', match.index);
  }
  for (const match of source.matchAll(/pushDevice\??:\s*\{[\s\S]{0,400}?token\s*[?:]/g)) {
    fail(file, 'Admin API notification delivery pushDevice type must not expose a raw token field.', match.index);
  }
}

function checkAdminUiTokenAccess() {
  for (const file of [
    'apps/admin_web/app/app-sessions/page.tsx',
    'apps/admin_web/app/customers/page.tsx',
    'apps/admin_web/app/customers/[id]/page.tsx',
    'apps/admin_web/app/notifications/page.tsx',
    'apps/admin_web/app/page.tsx',
    'apps/admin_web/app/partners/page.tsx',
    'apps/admin_web/app/partners/[id]/page.tsx',
  ]) {
    const source = read(file);
    reject(file, source, 'device.token', 'Admin UI must not read or display raw push device tokens.');
    reject(
      file,
      source,
      'maskToken(device.token)',
      'Admin UI must not mask raw push device tokens; tokens should not reach the browser.',
    );
  }
}

function checkAdminPaymentPayloadRedaction() {
  const file = 'apps/admin_web/app/payments/[id]/page.tsx';
  const source = read(file);

  if (!source.includes('PAYMENT_PAYLOAD_SECRET_KEY_PATTERN')) {
    fail(file, 'Payment callback raw payload display must define a sensitive-key redaction pattern.');
  }
  if (!source.includes('redactPaymentPayloadValue(record[key], key)')) {
    fail(file, 'Payment callback raw payload values must pass through redaction before rendering.');
  }
  reject(
    file,
    source,
    'compactValue(record[key])',
    'Payment callback raw payload values must not be rendered directly.',
  );
}

function checkAdminNotificationBodies() {
  const file = 'apps/api/src/admin/admin.service.ts';
  const source = read(file);

  for (const marker of ['body: reason', 'body: blockReason', 'body: normalizedReason']) {
    reject(file, source, marker, 'Admin notification bodies must not expose free-form operator reasons.');
  }
  for (const marker of [': (reason ??', ': (normalizedReason ??', ': (blockReason ??']) {
    reject(file, source, marker, 'Admin notification bodies must use generic copy instead of fallback operator reasons.');
  }
}

function reject(file, source, marker, message) {
  const index = source.indexOf(marker);
  if (index !== -1) {
    fail(file, `${message} Marker: ${marker}`, index);
  }
}

function fail(file, message, index = -1) {
  violations.push({ file, message, index });
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function relationObjectBlocks(source, relationName) {
  const blocks = [];
  let searchIndex = 0;

  while (searchIndex < source.length) {
    const relationIndex = source.indexOf(relationName, searchIndex);
    if (relationIndex === -1) {
      break;
    }

    const colonIndex = source.indexOf(':', relationIndex + relationName.length);
    const braceIndex = source.indexOf('{', relationIndex + relationName.length);
    if (colonIndex !== -1 && braceIndex !== -1 && colonIndex < braceIndex) {
      const content = sliceBalancedBlock(source, braceIndex);
      if (content) {
        blocks.push({ index: relationIndex, content });
        searchIndex = braceIndex + content.length;
        continue;
      }
    }
    searchIndex = relationIndex + relationName.length;
  }

  return blocks;
}

function sliceBalancedBlock(source, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex, index + 1);
      }
    }
  }

  return '';
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    return '';
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? undefined : end);
}
