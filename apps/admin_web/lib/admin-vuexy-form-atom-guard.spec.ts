import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const scanRoots = ['app', 'components'] as const;
const allowedNativeControlFiles = new Set([
  'components/action-menu.tsx',
  'components/admin-form-date-picker-field.tsx',
  'components/admin-form-controls.tsx',
  'components/admin-form-light-controls.tsx',
  'components/confirm-dialog.tsx',
]);

describe('Admin Vuexy form atom guard', () => {
  it('keeps visible native form controls behind shared Vuexy AdminForm atoms', () => {
    const violations = scanRoots
      .flatMap((root) => findSourceFiles(root))
      .flatMap((file) => visibleNativeFormControlViolations(file));

    expect(violations).toEqual([]);
  });
});

function findSourceFiles(root: string): string[] {
  const entries = readdirSync(root);

  return entries.flatMap((entry) => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return findSourceFiles(fullPath);
    }

    if (!fullPath.endsWith('.tsx') || fullPath.endsWith('.spec.tsx')) {
      return [];
    }

    return [normalizePath(fullPath)];
  });
}

function visibleNativeFormControlViolations(file: string): string[] {
  if (allowedNativeControlFiles.has(file)) {
    return [];
  }

  const source = readFileSync(file, 'utf8');
  return nativeControlTags(source)
    .filter((tag) => tag.name !== 'input' || nativeInputType(tag.raw) !== 'hidden')
    .map((tag) => `${file}:${lineNumberForIndex(source, tag.index)} ${tag.name}`);
}

function nativeControlTags(source: string) {
  const matches = source.matchAll(/<(input|select|textarea)\b[\s\S]*?>/g);
  return Array.from(matches, (match) => ({
    index: match.index ?? 0,
    name: match[1],
    raw: match[0],
  }));
}

function nativeInputType(tag: string) {
  const match = /\btype\s*=\s*["']([^"']+)["']/i.exec(tag);
  return match?.[1]?.toLowerCase() ?? 'text';
}

function lineNumberForIndex(source: string, index: number) {
  return source.slice(0, index).split(/\r\n|\r|\n/).length;
}

function normalizePath(file: string) {
  return relative(process.cwd(), file).replace(/\\/g, '/');
}
