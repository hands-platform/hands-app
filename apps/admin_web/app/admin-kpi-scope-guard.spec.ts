import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('Admin KPI scope guard', () => {
  it('keeps page-level KPI and trace metrics explicit about time/status scope', () => {
    const appRoot = join(process.cwd(), 'app');
    const files = collectSourceFiles(appRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      let index = 0;

      while ((index = source.indexOf('metrics={[', index)) !== -1) {
        const blockEnd = source.indexOf(']}', index);
        const block = source.slice(
          index,
          blockEnd === -1 ? Math.min(index + 1600, source.length) : blockEnd + 2,
        );
        const leadingSource = source.slice(Math.max(0, index - 500), index);
        const line = source.slice(0, index).split(/\r?\n/).length;
        const hasMetricObject = /\{\s*(?:\r?\n\s*)?(?:helper|label|value|className|kind|scope)\s*:/.test(
          block,
        );
        const hasTraceDefault =
          leadingSource.includes('<AdminTraceSummary') &&
          leadingSource.includes('defaultKind') &&
          leadingSource.includes('defaultScope');
        const isMiniMetricStrip = leadingSource.includes('<AdminMiniMetricStrip');

        if (!hasMetricObject || hasTraceDefault || isMiniMetricStrip) {
          index += 10;
          continue;
        }

        if (!block.includes('scope:') || !block.includes('kind:')) {
          offenders.push(`${file.slice(appRoot.length + 1)}:${line}`);
        }

        index += 10;
      }
    }

    expect(offenders).toEqual([]);
  });
});

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }
    if (!entry.isFile() || !entry.name.endsWith('.tsx') || /\.(?:spec|test)\.tsx$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}
