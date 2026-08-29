import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { Prisma, PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const APPLY_CONFIRMATION = 'PAUSE_REVIEWED_ACTIVE_OPEN_ENDED_SMOKE_COUPONS';

export function parseCouponSmokePauseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  return {
    apply: argv.includes('--apply'),
    confirmation: value('--confirm'),
    envFile: value('--env') ?? '.env',
    manifestPath: value('--manifest'),
    outputPath: value('--out'),
    reason: value('--reason')?.trim(),
  };
}

export function assertCouponSmokePauseApplyOptions(args) {
  if (!args.apply) return;
  if (
    args.confirmation !== APPLY_CONFIRMATION ||
    !args.manifestPath ||
    !args.reason ||
    args.reason.length < 12 ||
    args.reason.length > 500
  ) {
    throw new Error(
      `Apply requires --apply --confirm=${APPLY_CONFIRMATION} --manifest=<reviewed-dry-run.json> --reason=<12-500 characters>.`,
    );
  }
}

export function couponSmokeCandidateDigest(candidates) {
  const stable = candidates.map(({ active, code, endsAt, id, startsAt, usageCount }) => ({
    active,
    code,
    endsAt,
    id,
    startsAt,
    usageCount,
  }));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function assertReviewedCouponSmokeManifest(manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.mode !== 'dry-run' ||
    !Array.isArray(manifest.candidates) ||
    manifest.candidates.length === 0 ||
    manifest.candidateDigest !== couponSmokeCandidateDigest(manifest.candidates)
  ) {
    throw new Error('Reviewed manifest is missing, empty, modified, or not a coupon Smoke dry-run manifest.');
  }
}

export function assertCouponSmokeInventoryMatches(reviewed, current) {
  if (reviewed.length !== current.length) {
    throw new Error('Reviewed manifest is stale; coupon candidate count changed. Run dry-run again.');
  }
  const currentById = new Map(current.map((candidate) => [candidate.id, candidate]));
  for (const candidate of reviewed) {
    const latest = currentById.get(candidate.id);
    if (
      !latest ||
      latest.code !== candidate.code ||
      latest.active !== true ||
      latest.endsAt !== null ||
      latest.startsAt !== candidate.startsAt ||
      latest.usageCount !== candidate.usageCount ||
      !latest.code.startsWith('SMOKE')
    ) {
      throw new Error(`Reviewed manifest is stale for coupon ${candidate.id}. Run dry-run again.`);
    }
  }
}

async function main() {
  const args = parseCouponSmokePauseArgs(process.argv.slice(2));
  assertCouponSmokePauseApplyOptions(args);
  const { env } = loadMergedEnv(args.envFile);
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const reviewedManifest = args.apply
      ? JSON.parse(await readFile(path.resolve(args.manifestPath), 'utf8'))
      : null;
    if (reviewedManifest) assertReviewedCouponSmokeManifest(reviewedManifest);

    const candidates = args.apply
      ? await applyReviewedCandidates(prisma, reviewedManifest, args.reason)
      : await inventoryCandidates(prisma);
    const manifest = {
      schemaVersion: 1,
      mode: args.apply ? 'apply' : 'dry-run',
      generatedAt: new Date().toISOString(),
      readOnly: !args.apply,
      candidateDigest: couponSmokeCandidateDigest(candidates),
      safeguards: {
        activeRequired: true,
        codePrefix: 'SMOKE',
        deleteAllowed: false,
        explicitConfirmationRequired: true,
        openEndedRequired: true,
        reviewedManifestRequired: true,
        singleTransaction: true,
      },
      summary: summarizeCandidates(candidates),
      result: args.apply ? { paused: candidates.length } : { paused: 0 },
      candidates,
      rollback: 'Reactivate only through the audited Admin coupon activate action with a reviewed operational reason.',
      nextAction: args.apply
        ? 'Run the read-only inventory and verify one coupon.pause audit row per candidate.'
        : `Review this exact manifest, then use --apply --confirm=${APPLY_CONFIRMATION} with this file and an explicit reason.`,
    };
    const outputPath = path.resolve(
      args.outputPath ??
        `output/coupon-smoke-pause-${args.apply ? 'apply' : 'dry-run'}-${Date.now()}.json`,
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({
      candidateDigest: manifest.candidateDigest,
      mode: manifest.mode,
      outputPath,
      result: manifest.result,
      summary: manifest.summary,
    }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

async function inventoryCandidates(prismaClient, requestedIds) {
  const coupons = await prismaClient.coupon.findMany({
    where: requestedIds
      ? { id: { in: requestedIds } }
      : { active: true, code: { startsWith: 'SMOKE' }, endsAt: null },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
    select: { active: true, code: true, endsAt: true, id: true, startsAt: true },
  });
  if (coupons.length === 0) return [];

  const candidateValues = Prisma.join(
    coupons.map((coupon) => Prisma.sql`(${coupon.id}::text, ${coupon.code}::text)`),
  );
  const usageRows = await prismaClient.$queryRaw(Prisma.sql`
    WITH candidate("id", "code") AS (VALUES ${candidateValues})
    SELECT
      candidate."id" AS "couponId",
      COUNT(DISTINCT payment."bookingId")::bigint AS "usageCount"
    FROM candidate
    LEFT JOIN "Payment" payment
      ON payment."rawMeta"->>'couponId' = candidate."id"
      OR payment."rawMeta"->>'couponCode' = candidate."code"
    GROUP BY candidate."id"
  `);
  const usageByCouponId = new Map(
    usageRows.map((row) => [row.couponId, Number(row.usageCount)]),
  );
  return coupons.map((coupon) => ({
    active: coupon.active,
    code: coupon.code,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    id: coupon.id,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    usageCount: usageByCouponId.get(coupon.id) ?? 0,
  }));
}

async function applyReviewedCandidates(prismaClient, reviewedManifest, reason) {
  const reviewed = reviewedManifest.candidates;
  return prismaClient.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('coupon-smoke-pause-remediation', 0))::text AS "lockResult"`;
    const current = await inventoryCandidates(tx, reviewed.map((candidate) => candidate.id));
    assertCouponSmokeInventoryMatches(reviewed, current);

    const paused = await tx.coupon.updateMany({
      where: {
        active: true,
        code: { startsWith: 'SMOKE' },
        endsAt: null,
        id: { in: current.map((candidate) => candidate.id) },
      },
      data: { active: false },
    });
    if (paused.count !== current.length) {
      throw new Error('Coupon candidate state changed during apply; the transaction was rolled back.');
    }

    const occurredAt = new Date();
    await tx.adminAuditLog.createMany({
      data: current.map((candidate) => ({
        action: 'coupon.pause',
        actorId: null,
        actorKey: 'coupon-smoke-pause-remediation',
        actorLabelSnapshot: 'User-approved Codex remediation',
        actorType: 'SYSTEM',
        area: 'OPERATOR',
        eventId: `coupon-smoke-pause:${reviewedManifest.candidateDigest}:${candidate.id}`,
        metadata: {
          after: { active: false },
          approvalSource: 'Codex user approval on 2026-08-27',
          before: { active: true },
          code: candidate.code,
          couponId: candidate.id,
          reason,
          reviewedManifestDigest: reviewedManifest.candidateDigest,
          source: 'coupon_smoke_pause_remediation',
          usageCount: candidate.usageCount,
        },
        objectId: candidate.id,
        objectLabelSnapshot: candidate.code,
        objectType: 'coupon',
        occurredAt,
        outcome: 'SUCCEEDED',
        recordedAt: occurredAt,
        severity: 'NOTICE',
        source: 'coupon_smoke_pause_remediation',
        target: `coupon:${candidate.id}`,
      })),
    });
    return current;
  });
}

function summarizeCandidates(candidates) {
  return {
    active: candidates.filter((candidate) => candidate.active).length,
    activeOpenEnded: candidates.filter((candidate) => candidate.active && !candidate.endsAt).length,
    candidateCount: candidates.length,
    withUsage: candidates.filter((candidate) => candidate.usageCount > 0).length,
  };
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (isMain) await main();
