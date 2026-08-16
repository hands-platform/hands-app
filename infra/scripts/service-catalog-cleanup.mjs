import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, ServiceCatalogProvenance, ServicePublicationStatus } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  assertReviewedManifest,
  assertServiceCatalogCleanupApplyOptions,
  classifyServiceCatalogCandidate,
  summarizeServiceCatalogCandidates,
} from './lib/service-catalog-cleanup.mjs';

const args = parseArgs(process.argv.slice(2));
const { env } = loadMergedEnv(args.envFile);
const databaseUrl = env.DATABASE_URL?.trim();

assert(databaseUrl, 'DATABASE_URL is required.');
assertServiceCatalogCleanupApplyOptions(args);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const reviewedManifest = args.apply
    ? JSON.parse(await readFile(path.resolve(args.manifestPath), 'utf8'))
    : null;
  if (reviewedManifest) assertReviewedManifest(reviewedManifest);

  const candidateIds = reviewedManifest?.candidates.map((candidate) => candidate.id);
  const candidates = await inventoryCandidates(prisma, candidateIds);

  if (reviewedManifest) {
    assertInventoryStillMatches(reviewedManifest.candidates, candidates);
  }

  const result = args.apply
    ? await applyReviewedCandidates(prisma, candidates)
    : { archived: 0, deleted: 0 };
  const manifest = {
    schemaVersion: 1,
    mode: args.apply ? 'apply' : 'dry-run',
    generatedAt: new Date().toISOString(),
    safeguards: {
      candidateSource: 'explicit provenance only',
      deleteRequiresZeroReferences: true,
      reviewedManifestRequiredForApply: true,
      explicitConfirmationRequiredForApply: true,
      substringClassificationUsed: false,
    },
    summary: summarizeServiceCatalogCandidates(candidates),
    result,
    candidates,
  };

  const outputPath = path.resolve(
    args.outputPath ??
      `output/service-catalog-cleanup-${args.apply ? 'apply' : 'manifest'}-${Date.now()}.json`,
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  printHumanSummary(manifest, outputPath);
} finally {
  await prisma.$disconnect();
}

async function inventoryCandidates(prismaClient, requestedIds) {
  const services = await prismaClient.massageService.findMany({
    where: {
      id: requestedIds ? { in: requestedIds } : undefined,
      provenance: {
        in: [ServiceCatalogProvenance.SMOKE_TEST, ServiceCatalogProvenance.MIGRATION],
      },
    },
    orderBy: [{ provenance: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      serviceGroupKey: true,
      durationMin: true,
      publicationStatus: true,
      provenance: true,
      provenanceRunId: true,
    },
  });
  const ids = services.map((service) => service.id);
  if (ids.length === 0) return [];

  const [bookingRefs, priceRefs, payoutRefs, auditRows] = await Promise.all([
    prismaClient.bookingService.groupBy({
      by: ['serviceId'],
      where: { serviceId: { in: ids } },
      _count: { _all: true },
    }),
    prismaClient.providerService.groupBy({
      by: ['serviceId'],
      where: { serviceId: { in: ids } },
      _count: { _all: true },
    }),
    prismaClient.servicePayoutRule.groupBy({
      by: ['serviceId'],
      where: { serviceId: { in: ids } },
      _count: { _all: true },
    }),
    prismaClient.adminAuditLog.findMany({
      where: {
        target: {
          in: services.flatMap((service) => [
            `service:${service.id}`,
            ...(service.serviceGroupKey ? [`service_group:${service.serviceGroupKey}`] : []),
          ]),
        },
      },
      select: { target: true },
    }),
  ]);

  const bookingsByService = countMap(bookingRefs);
  const pricesByService = countMap(priceRefs);
  const payoutsByService = countMap(payoutRefs);
  const auditsByTarget = new Map();
  for (const row of auditRows) {
    auditsByTarget.set(row.target, (auditsByTarget.get(row.target) ?? 0) + 1);
  }

  return services.map((service) =>
    classifyServiceCatalogCandidate(service, {
      audits:
        (auditsByTarget.get(`service:${service.id}`) ?? 0) +
        (service.serviceGroupKey
          ? (auditsByTarget.get(`service_group:${service.serviceGroupKey}`) ?? 0)
          : 0),
      bookings: bookingsByService.get(service.id) ?? 0,
      payoutRules: payoutsByService.get(service.id) ?? 0,
      prices: pricesByService.get(service.id) ?? 0,
    }),
  );
}

async function applyReviewedCandidates(prismaClient, candidates) {
  let archived = 0;
  let deleted = 0;

  await prismaClient.$transaction(async (tx) => {
    for (const candidate of candidates) {
      if (candidate.expectedAction === 'ARCHIVE') {
        archived += (
          await tx.massageService.updateMany({
            where: {
              id: candidate.id,
              provenance: candidate.provenance,
              OR: [
                { active: true },
                { publicationStatus: { not: ServicePublicationStatus.ARCHIVED } },
              ],
            },
            data: {
              active: false,
              publicationStatus: ServicePublicationStatus.ARCHIVED,
            },
          })
        ).count;
        continue;
      }

      const deletedRow = await tx.massageService.deleteMany({
        where: {
          id: candidate.id,
          provenance: candidate.provenance,
          bookings: { none: {} },
          providers: { none: {} },
          payoutRules: { none: {} },
        },
      });
      deleted += deletedRow.count;
      if (deletedRow.count !== 1) {
        throw new Error(`Service ${candidate.id} gained a reference; cleanup was rolled back.`);
      }
    }
  });

  return { archived, deleted };
}

function assertInventoryStillMatches(reviewedCandidates, currentCandidates) {
  const currentById = new Map(currentCandidates.map((candidate) => [candidate.id, candidate]));
  if (currentCandidates.length !== reviewedCandidates.length) {
    throw new Error('Reviewed manifest is stale; candidate inventory changed. Run dry-run again.');
  }
  for (const reviewed of reviewedCandidates) {
    const current = currentById.get(reviewed.id);
    if (
      !current ||
      current.provenance !== reviewed.provenance ||
      current.expectedAction !== reviewed.expectedAction ||
      JSON.stringify(current.references) !== JSON.stringify(reviewed.references)
    ) {
      throw new Error(`Reviewed manifest is stale for service ${reviewed.id}. Run dry-run again.`);
    }
  }
}

function countMap(rows) {
  return new Map(rows.map((row) => [row.serviceId, row._count._all]));
}

function parseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  return {
    apply: argv.includes('--apply'),
    confirmation: value('--confirm'),
    envFile: value('--env') ?? '.env',
    manifestPath: value('--manifest'),
    outputPath: value('--out'),
  };
}

function printHumanSummary(manifest, outputPath) {
  console.log(`Service Catalog cleanup ${manifest.mode}`);
  console.log(`Candidates: ${manifest.summary.candidateCount}`);
  console.log(`Archive: ${manifest.summary.byAction.ARCHIVE}`);
  console.log(`Delete: ${manifest.summary.byAction.DELETE}`);
  if (manifest.mode === 'apply') {
    console.log(`Applied: ${manifest.result.archived} archived, ${manifest.result.deleted} deleted`);
  } else {
    console.log('No database rows were changed.');
  }
  console.log(`Manifest: ${outputPath}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
