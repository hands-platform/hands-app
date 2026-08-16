import {
  PrismaClient,
  TaxPolicyLifecycleStatus,
  TaxPolicyProvenance,
  TaxPolicyStatus,
} from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

if (process.argv.includes('--apply')) {
  throw new Error('Tax policy fixture cleanup is dry-run only. Review candidates in Admin before any manual change.');
}

const envFile = process.env.HANDS_ENV_FILE ?? '.env';
const { env, envPath } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is missing from ${envPath}.`);

const prisma = new PrismaClient();

try {
  const policies = await prisma.taxPolicyVersion.findMany({
    where: {
      provenance: {
        in: [TaxPolicyProvenance.SMOKE_TEST, TaxPolicyProvenance.SEED],
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      status: true,
      lifecycleStatus: true,
      provenance: true,
      effectiveFrom: true,
      createdAt: true,
      _count: { select: { taxLogs: true, bookingSettlementSnapshots: true } },
    },
  });

  const report = policies.map((policy) => {
    const referenced =
      policy._count.taxLogs > 0 || policy._count.bookingSettlementSnapshots > 0;
    const active =
      policy.status === TaxPolicyStatus.ACTIVE ||
      policy.lifecycleStatus === TaxPolicyLifecycleStatus.ACTIVE;
    return {
      ...policy,
      severity: active ? 'CRITICAL' : referenced ? 'HIGH' : 'REVIEW',
      recommendedAction: active || referenced
        ? 'RETAIN_AND_MANUAL_REVIEW'
        : 'MANUAL_DELETE_CANDIDATE',
      reason: active
        ? 'Fixture policy is ACTIVE. Replace it through the governed approval flow before cleanup.'
        : referenced
          ? 'Fixture policy is referenced by financial records and must remain immutable.'
          : 'Unreferenced fixture draft; confirm ownership and retention policy before manual deletion.',
    };
  });

  process.stdout.write(`${JSON.stringify({ mode: 'dry-run', count: report.length, policies: report }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
