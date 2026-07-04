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

  it('keeps visible text inputs inside shared Vuexy input atoms', () => {
    const allowedRawInputFiles = new Set([
      'components/admin-form-controls.tsx',
      'components/admin-topbar-search-input.tsx',
    ]);
    const offenders = productionTsxFiles()
      .filter((filePath) => !allowedRawInputFiles.has(relative(process.cwd(), filePath).replaceAll('\\', '/')))
      .filter((filePath) => visibleRawInputPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps react-datepicker instances on the shared Vuexy calendar skin', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('<DatePicker'))
      .filter((filePath) => !usesVuexyDatePickerSkin(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

const legacyToneButtonClassNamePattern =
  /className="[^"]*\bbutton\s+button-(?:danger|info|outline|primary|secondary|success)\b/;
const nativeCalendarInputTypePattern = /<input\b[^>]*\btype=["'](?:date|datetime-local|month|time)["']/;
const visibleRawInputPattern = /<input\b(?![^>]*\btype=["']hidden["'])/s;

function productionTsxFiles() {
  return ['app', 'components']
    .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
    .filter((filePath) => !filePath.endsWith('.spec.tsx'));
}

function usesVuexyDatePickerSkin(source: string) {
  const datePickerCount = source.match(/<DatePicker\b/g)?.length ?? 0;
  const vuexySkinCount = source.match(/calendarClassName="[^"]*\bcalendar-vuexy-datepicker\b/g)?.length ?? 0;
  return datePickerCount === vuexySkinCount;
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
