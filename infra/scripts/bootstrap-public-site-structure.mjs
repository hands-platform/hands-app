import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import { classifyPublicSiteRouteMigration } from './lib/public-site-route-migration.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(
  resolve(root, 'apps/api/src/site-content/public-site-route-manifest.json'),
  'utf8',
));
const envFile = argument('env') ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();
try {
  const pages = await prisma.publicSitePage.findMany({
    where: { NOT: { path: { startsWith: '/news/' } } },
    orderBy: [{ site: 'asc' }, { locale: 'asc' }, { path: 'asc' }],
    include: {
      sections: { orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] },
      revisions: { select: { id: true, state: true, revisionNumber: true } },
    },
  });
  const plan = classifyPublicSiteRouteMigration(manifest, pages);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    applyExecuted: false,
    ...plan,
    items: plan.items.map(({ page: _page, ...item }) => item),
  };
  const outputPath = argument('output');
  if (!process.argv.includes('--apply')) {
    if (outputPath) await writeFile(resolve(root, outputPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 0;
  } else {
    assertApplyAllowed(plan.checksum, env);
    if (plan.summary.BLOCKED || plan.summary.CONFLICT) {
      throw new Error('Apply is blocked while BLOCKED or CONFLICT rows exist. Resolve them manually first.');
    }
    await applyPlan(plan.items);
    report.applyExecuted = true;
    if (outputPath) await writeFile(resolve(root, outputPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    console.log(`Applied route plan ${plan.checksum}. Re-run dry-run and require zero CREATE/BACKFILL_REVISION/MOVE_ROUTE rows.`);
  }
} finally {
  await prisma.$disconnect();
}

async function applyPlan(items) {
  for (const row of items) {
    if (!['CREATE', 'BACKFILL_REVISION', 'MOVE_ROUTE'].includes(row.action)) continue;
    await prisma.$transaction(async (tx) => {
      if (row.action === 'CREATE') {
        const page = await tx.publicSitePage.create({
          data: { site: row.site, locale: row.locale, path: row.path, internalName: row.label, status: 'DRAFT', noIndex: true },
        });
        const draft = await tx.publicSitePageRevision.create({
          data: {
            pageId: page.id,
            revisionNumber: 1,
            state: 'DRAFT',
            noIndex: true,
            readinessState: 'BLOCKED',
            readinessIssues: ['SEO title is required.', 'SEO description is required.', 'At least one enabled section is required.'],
            sections: { create: sectionRows(row) },
          },
        });
        await tx.publicSitePage.update({ where: { id: page.id }, data: { draftRevisionId: draft.id } });
        return;
      }
      if (row.action === 'MOVE_ROUTE') {
        await tx.publicSitePage.update({ where: { id: row.pageId }, data: { path: row.path, internalName: row.label } });
        return;
      }
      const page = await tx.publicSitePage.findUnique({ where: { id: row.pageId }, include: { sections: { orderBy: { sortOrder: 'asc' } } } });
      if (!page || page.activeRevisionId || page.draftRevisionId) return;
      const draft = await tx.publicSitePageRevision.create({
        data: {
          pageId: page.id,
          revisionNumber: 1,
          state: 'DRAFT',
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          canonicalPath: page.canonicalPath,
          noIndex: page.noIndex,
          readinessState: 'UNKNOWN',
          readinessIssues: [],
          sections: { create: page.sections.length ? page.sections.map((section) => ({ key: section.key, kind: section.kind, content: section.content, sortOrder: section.sortOrder, enabled: section.enabled })) : sectionRows(row) },
        },
      });
      await tx.publicSitePage.update({ where: { id: page.id }, data: { draftRevisionId: draft.id } });
    });
  }
}

function sectionRows(row) {
  const entry = manifest.find((item) => item.site === row.site && item.path === row.path);
  return (entry?.sectionKinds ?? []).map((kind, index) => ({
    key: `${kind.toLowerCase().replaceAll('_', '-')}-${index + 1}`,
    kind,
    content: {},
    sortOrder: index * 10,
    enabled: true,
  }));
}

function assertApplyAllowed(checksum, loadedEnv) {
  if (argument('confirm') !== checksum) throw new Error(`Apply requires --confirm=${checksum}`);
  if (loadedEnv.NODE_ENV === 'production' || loadedEnv.APP_ENV === 'production') {
    throw new Error('Public site route apply is never allowed against production from this script.');
  }
  if (loadedEnv.ALLOW_PUBLIC_SITE_BOOTSTRAP !== 'true') {
    throw new Error('Apply requires ALLOW_PUBLIC_SITE_BOOTSTRAP=true in a non-production environment.');
  }
}

function argument(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}
