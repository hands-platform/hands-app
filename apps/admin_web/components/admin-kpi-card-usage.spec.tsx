import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin KPI card usage', () => {
  it('keeps app pages and shared wrappers on the AdminKpiCard surface instead of importing MetricCard directly', () => {
    const offenders = [
      ...listTsxFiles(join(process.cwd(), 'app')),
      ...listTsxFiles(join(process.cwd(), 'components')),
    ]
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => !allowedMetricCardImports.has(relative(process.cwd(), filePath).replaceAll('\\', '/')))
      .filter((filePath) => directMetricCardImportPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps page-specific KPI CSS scoped to MetricCard internals', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(css).toContain('.marketing-analytics-metric .metric-card h2');
    expect(css).toContain('.vietnam-overview-metric .metric-card h2');
    expect(css).not.toContain('.marketing-analytics-metric h2,');
    expect(css).not.toContain('.vietnam-overview-metric h2,');
    expect(css).not.toContain('.marketing-analytics-metric small,');
    expect(css).not.toContain('.vietnam-overview-metric small');
  });
});

const allowedMetricCardImports = new Set(['components/admin-surface.tsx', 'components/metric-card.tsx']);
const directMetricCardImportPattern = /from ['"](?:\.\/metric-card|(?:\.\.\/)+components\/metric-card)['"]/;

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
