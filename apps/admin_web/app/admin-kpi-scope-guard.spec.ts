import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Admin KPI scope guard', () => {
  it('keeps page-level KPI and trace metrics explicit about time/status scope', () => {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const files = execSync('git ls-files apps/admin_web/app/**/*.tsx', {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), 'utf8');
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
          offenders.push(`${file}:${line}`);
        }

        index += 10;
      }
    }

    expect(offenders).toEqual([]);
  });
});
