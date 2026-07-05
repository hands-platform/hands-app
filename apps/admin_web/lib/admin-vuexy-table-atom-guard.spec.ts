import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoots = ['app', 'components'] as const;
const allowedTablePrimitiveFiles = new Set(['components/admin-data-table.tsx']);
const allowedTableChromeFiles = new Set(['components/admin-table-panel.tsx', 'app/globals.css']);
const tableChromeClasses = ['vuexy-booking-table-card', 'vuexy-booking-table-group'] as const;

describe('Admin Vuexy table atom guard', () => {
  it('keeps table primitives behind the shared AdminDataTable component', () => {
    const violations = sourceRoots
      .flatMap((root) => findSourceFiles(root))
      .filter((file) => !allowedTablePrimitiveFiles.has(file))
      .flatMap((file) => tablePrimitiveViolations(file));

    expect(violations).toEqual([]);
  });

  it('keeps table panel chrome behind shared Vuexy panel components', () => {
    const violations = sourceRoots
      .flatMap((root) => findSourceFiles(root))
      .filter((file) => !allowedTableChromeFiles.has(file))
      .flatMap((file) => tableChromeViolations(file));

    expect(violations).toEqual([]);
  });
});

function findSourceFiles(root: string): string[] {
  const entries = readdirSync(root);

  return entries.flatMap((entry) => {
    const fullPath = normalizePath(join(root, entry));
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return findSourceFiles(fullPath);
    }

    if (!isSourceFile(fullPath)) {
      return [];
    }

    return [fullPath];
  });
}

function isSourceFile(file: string) {
  return (
    (file.endsWith('.tsx') || file.endsWith('.css')) &&
    !file.endsWith('.spec.tsx') &&
    !file.endsWith('.spec.ts')
  );
}

function tablePrimitiveViolations(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return indexedMatches(source, /<table\b/g).map((index) => `${file}:${lineNumberForIndex(source, index)} <table>`);
}

function tableChromeViolations(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return tableChromeClasses.flatMap((className) =>
    indexedMatches(source, new RegExp(`\\b${className}\\b`, 'g')).map(
      (index) => `${file}:${lineNumberForIndex(source, index)} ${className}`,
    ),
  );
}

function indexedMatches(source: string, pattern: RegExp): number[] {
  return Array.from(source.matchAll(pattern), (match) => match.index ?? 0);
}

function lineNumberForIndex(source: string, index: number) {
  return source.slice(0, index).split(/\r\n|\r|\n/).length;
}

function normalizePath(file: string) {
  return file.replace(/\\/g, '/');
}
