import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin KPI card usage', () => {
  it('keeps app pages on the shared AdminKpiCard surface instead of importing MetricCard directly', () => {
    const offenders = listTsxFiles(join(process.cwd(), 'app'))
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => directMetricCardImportPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

const directMetricCardImportPattern = /from ['"](?:\.\.\/)+components\/metric-card['"]/;

function listTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return listTsxFiles(filePath);
    }
    return filePath.endsWith('.tsx') ? [filePath] : [];
  });
}
