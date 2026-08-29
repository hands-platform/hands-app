import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { SiteContentService } from '../../apps/api/src/site-content/site-content.service';

const output = process.argv.find((value) => value.startsWith('--output='))?.slice(9);
const queueOutput = process.argv.find((value) => value.startsWith('--queue-output='))?.slice(15);
if (!output) throw new Error('Readiness audit requires --output=<path>.');

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const prisma = new PrismaService();
  try {
    const report = await new SiteContentService(prisma).readinessDryRun();
    await writeFile(resolve(output!), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const grouped = new Map<string, typeof report.items>();
    for (const item of report.items) {
      const key = `${item.site}|${item.path}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    const groups = [...grouped.values()].map((items) => {
      const issues = [...new Set(items.flatMap((item) => item.issues))].sort();
      const maxIssueCount = Math.max(...items.map((item) => item.issues.length));
      return {
        site: items[0].site,
        path: items[0].path,
        workOrder: maxIssueCount >= 5 ? 1 : maxIssueCount === 4 ? 2 : 3,
        localeRows: items.length,
        locales: items.map((item) => item.locale).sort(),
        previousStates: count(items.map((item) => item.previousState)),
        nextStates: count(items.map((item) => item.nextState)),
        maxIssueCount,
        issues,
        recommendedActions: [
          'Add a localized SEO title and description.',
          'Complete every enabled section until the shared renderer accepts it.',
          'Preview each locale and rerun the read-only readiness audit before saving a readiness state.',
        ],
      };
    }).sort((left, right) => left.workOrder - right.workOrder
      || left.site.localeCompare(right.site)
      || left.path.localeCompare(right.path));
    if (queueOutput) {
      await writeFile(resolve(queueOutput), `${JSON.stringify({
        generatedAt: report.generatedAt,
        applyExecuted: false,
        totalRouteGroups: groups.length,
        totalLocaleRows: report.items.length,
        groups,
      }, null, 2)}\n`, 'utf8');
    }

    console.log(JSON.stringify({
      applyExecuted: report.applyExecuted,
      routeGroups: groups.length,
      issueCounts: count(report.items.flatMap((item) => item.issues)),
      total: report.items.length,
      transitions: count(report.items.map((item) => `${item.previousState}->${item.nextState}`)),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function count(values: string[]) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    value,
    values.filter((candidate) => candidate === value).length,
  ]));
}
