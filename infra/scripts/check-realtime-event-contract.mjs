import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiEvents = readConstStringArray(resolve(repoRoot, 'apps/api/src/common/domain.ts'), 'REALTIME_EVENTS');
const sharedEvents = readConstStringArray(resolve(repoRoot, 'packages/shared-types/src/index.ts'), 'REALTIME_EVENTS');

const sharedEventSet = new Set(sharedEvents);
const missingFromShared = apiEvents.filter((event) => !sharedEventSet.has(event));
const duplicateApiEvents = duplicates(apiEvents);
const duplicateSharedEvents = duplicates(sharedEvents);

const result = {
  ok: missingFromShared.length === 0 && duplicateApiEvents.length === 0 && duplicateSharedEvents.length === 0,
  apiEventCount: apiEvents.length,
  sharedEventCount: sharedEvents.length,
  missingFromShared,
  duplicateApiEvents,
  duplicateSharedEvents,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function readConstStringArray(filePath, exportName) {
  const source = readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`(?:export\\s+)?const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`));
  if (!match) {
    throw new Error(`Unable to find ${exportName} const array in ${filePath}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}
