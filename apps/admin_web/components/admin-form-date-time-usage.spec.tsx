import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin date-time form usage', () => {
  it('keeps app datetime-local fields behind AdminFormDateTime', () => {
    const appDir = join(process.cwd(), 'app');
    const offenders = listTsxFiles(appDir)
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('type="datetime-local"'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

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
