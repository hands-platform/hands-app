import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin date-time form usage', () => {
  it('keeps app datetime-local fields behind AdminFormDateTime', () => {
    const appDir = join(process.cwd(), 'app');
    const offenders = listTsxFiles(appDir)
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => containsNativeDateTimeField(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps app date, month, and time fields behind AdminFormDate', () => {
    const appDir = join(process.cwd(), 'app');
    const offenders = listTsxFiles(appDir)
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => containsNativeCalendarField(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps app form control shells behind shared AdminForm atoms', () => {
    const appDir = join(process.cwd(), 'app');
    const offenders = listTsxFiles(appDir)
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => containsRawAdminFormShell(readFileSync(filePath, 'utf8')))
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

function containsNativeCalendarField(source: string) {
  return /\btype=\{?['"`](date|month|time)['"`]\}?/.test(source);
}

function containsNativeDateTimeField(source: string) {
  return /\btype=\{?['"`]datetime-local['"`]\}?/.test(source);
}

function containsRawAdminFormShell(source: string) {
  return [
    '<div className="admin-form-input',
    '<label className="admin-form-input',
    '<label className="admin-form-select',
    '<label className="admin-form-textarea',
  ].some((needle) => source.includes(needle));
}
