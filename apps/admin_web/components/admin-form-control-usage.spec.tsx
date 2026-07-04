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

  it('keeps native calendar input types inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => nativeCalendarInputTypePattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

const legacyToneButtonClassNamePattern =
  /className="[^"]*\bbutton\s+button-(?:danger|info|outline|primary|secondary|success)\b/;
const nativeCalendarInputTypePattern = /<input\b[^>]*\btype=["'](?:date|datetime-local|month|time)["']/;

function productionTsxFiles() {
  return ['app', 'components']
    .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
    .filter((filePath) => !filePath.endsWith('.spec.tsx'));
}

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
