import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  buildCompanyBankAccountCleanupManifest,
  COMPANY_BANK_ACCOUNT_CLEANUP_CONFIRM,
  companyBankAccountCleanupManifestHash,
} from './lib/company-bank-account-cleanup.mjs';

const envFile = argumentValue('--env') ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const apply = process.argv.includes('--apply');
const manifestPath = argumentValue('--manifest');
const confirmation = argumentValue('--confirm');
const reviewedHash = argumentValue('--hash');

if (apply && (!manifestPath || !reviewedHash || confirmation !== COMPANY_BANK_ACCOUNT_CLEANUP_CONFIRM)) {
  throw new Error(
    `Cleanup apply requires --manifest=<reviewed-manifest>, --hash=<reviewed-manifest-hash>, and --confirm=${COMPANY_BANK_ACCOUNT_CLEANUP_CONFIRM}`,
  );
}

const prisma = new PrismaClient();
try {
  if (apply) {
    const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
    if (manifest.manifestHash !== reviewedHash || companyBankAccountCleanupManifestHash(manifest) !== reviewedHash) {
      throw new Error('Cleanup manifest hash does not match the reviewed manifest');
    }
    const candidateIds = manifest.accounts
      .filter((row) => row.decision?.action === 'delete-candidate')
      .map((row) => row.id);
    const deleted = [];
    for (const id of candidateIds) {
      const account = await accountInventoryRow(id);
      if (!account) continue;
      const freshManifest = buildCompanyBankAccountCleanupManifest([account]);
      if (freshManifest.accounts[0]?.decision?.action !== 'delete-candidate') {
        throw new Error(`Cleanup candidate changed after review: ${id}`);
      }
      await prisma.companyBankAccount.delete({ where: { id } });
      deleted.push(id);
    }
    console.log(JSON.stringify({ applied: true, deleted }, null, 2));
  } else {
    const accounts = await prisma.companyBankAccount.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        dataScope: true,
        name: true,
        bankName: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });
    const inventory = [];
    for (const account of accounts) inventory.push(await accountInventoryRow(account.id, account));
    const manifest = buildCompanyBankAccountCleanupManifest(inventory.filter(Boolean));
    const outputPath = resolve(
      argumentValue('--out') ??
        `output/company-bank-accounts-cleanup-manifest-${manifest.generatedAt.replaceAll(/[:.]/gu, '-')}.json`,
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ manifestPath: outputPath, ...manifest.counts }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

async function accountInventoryRow(id, accountInput) {
  const account = accountInput ?? await prisma.companyBankAccount.findUnique({
    where: { id },
    select: { id: true, name: true, bankName: true, dataScope: true, status: true, metadata: true, createdAt: true },
  });
  if (!account) return null;
  const [transactions, reconciliationMatches, auditEvents] = await Promise.all([
    prisma.companyBankTransaction.count({ where: { bankAccountId: id } }),
    prisma.bankReconciliationMatch.count({ where: { bankTransaction: { bankAccountId: id } } }),
    prisma.adminAuditLog.count({ where: { target: `company_bank_account:${id}` } }),
  ]);
  const metadata = account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
    ? account.metadata
    : {};
  return {
    id: account.id,
    name: account.name,
    bankName: account.bankName,
    dataScope: account.dataScope,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    metadata,
    pendingApproval: Boolean(metadata.pendingApproval),
    references: {
      transactions,
      reconciliationMatches,
      importBatches: null,
      payments: null,
      refunds: null,
      payouts: null,
      auditEvents,
    },
    unsupportedDirectReferences: ['importBatches', 'payments', 'refunds', 'payouts'],
  };
}

function argumentValue(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}
