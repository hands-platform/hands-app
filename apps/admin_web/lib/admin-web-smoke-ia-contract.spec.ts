import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd(), '..', '..');

describe('admin web smoke IA contract', () => {
  it('keeps Developer/System routes out of default operator smoke paths', () => {
    const scriptSource = readFileSync(resolve(repoRoot, 'infra/scripts/admin-web-smoke.mjs'), 'utf8');
    const developerRoutes = ['/setup', '/app-sessions'];

    for (const listName of ['criticalSmokePaths', 'budgetSmokePaths']) {
      const paths = literalArray(scriptSource, listName);

      for (const route of developerRoutes) {
        expect(paths).not.toContain(route);
      }
    }

    expect(scriptSource).toContain("path: '/setup'");
    expect(scriptSource).toContain("path: '/app-sessions'");
  });
});

function literalArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`, 'u'));

  if (!match) {
    throw new Error(`Missing ${name}`);
  }

  return Array.from(match[1].matchAll(/'([^']+)'/gu), (arrayMatch) => arrayMatch[1]);
}
