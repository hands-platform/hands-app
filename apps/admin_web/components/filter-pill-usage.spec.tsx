import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('filter pill usage', () => {
  it('keeps filter links on the shared Vuexy pill link surface', () => {
    const appDir = join(process.cwd(), 'app');
    const offenders = collectFiles(appDir)
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('.spec.tsx'))
      .filter((file) => readFileSync(file, 'utf8').includes('filter-pill'));

    expect(offenders).toEqual([]);
  });
});

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
