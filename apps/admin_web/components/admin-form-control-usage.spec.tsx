import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin form control usage', () => {
  it('keeps legacy full tone button class names out of production TSX', () => {
    const offenders = ['app', 'components']
      .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => legacyToneButtonClassNamePattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

const legacyToneButtonClassNamePattern =
  /className="[^"]*\bbutton\s+button-(?:danger|info|outline|primary|secondary|success)\b/;

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
