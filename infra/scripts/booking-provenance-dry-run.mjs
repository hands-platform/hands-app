import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import { buildBookingProvenanceManifest } from './lib/booking-provenance-classifier.mjs';

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.split('=');
  return [key, value.join('=') || true];
}));

if (args.has('--apply')) {
  fail('Apply is intentionally disabled. Review the generated manifest and obtain operator approval before a separate write tool is introduced.');
}

const envFile = String(args.get('--env') || '.env');
const outputPath = resolve(String(
  args.get('--out') || 'output/usage-overview-improvement-verification-2026-08-13/booking-provenance-dry-run.json',
));
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for the booking provenance dry-run.');

const prisma = new PrismaClient();

try {
  const bookings = await prisma.booking.findMany({
    orderBy: { id: 'asc' },
    select: {
      createdAt: true,
      customerProfileId: true,
      id: true,
      metadata: true,
      preferredProviderId: true,
      selectedProviderId: true,
      customerProfile: { select: { user: { select: { fixtureKind: true, fullName: true } } } },
      preferredProvider: { select: { displayName: true, user: { select: { fixtureKind: true } } } },
      selectedProvider: { select: { displayName: true, user: { select: { fixtureKind: true } } } },
    },
  });
  const records = bookings.map((booking) => ({
    createdAt: booking.createdAt,
    customerFixtureKind: booking.customerProfile.user.fixtureKind,
    customerName: booking.customerProfile.user.fullName,
    customerProfileId: booking.customerProfileId,
    id: booking.id,
    metadata: booking.metadata,
    preferredProviderFixtureKind: booking.preferredProvider?.user.fixtureKind,
    preferredProviderId: booking.preferredProviderId,
    preferredProviderName: booking.preferredProvider?.displayName,
    selectedProviderFixtureKind: booking.selectedProvider?.user.fixtureKind,
    selectedProviderId: booking.selectedProviderId,
    selectedProviderName: booking.selectedProvider?.displayName,
  }));
  const manifest = buildBookingProvenanceManifest(records);
  const output = {
    ...manifest,
    environment: { envFileExists, envPath },
    instructions: 'Review REVIEW_UNKNOWN and CONFLICT rows. No database changes were made.',
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    apply: false,
    counts: manifest.counts,
    manifestDigest: manifest.manifestDigest,
    outputPath,
    totalBookingCount: manifest.totalBookingCount,
  }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, apply: false, error: message }, null, 2));
  process.exitCode = 1;
  throw new Error(message);
}
