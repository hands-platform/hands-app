import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const appRoot = join(process.cwd(), 'app');

describe('Admin page filter panel consistency', () => {
  it('keeps page filters on shared form/filter atoms instead of native controls', () => {
    const offenders = sourceFiles(appRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const relativePath = relative(process.cwd(), file).split(sep).join('/');

      return forbiddenPatterns
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${relativePath}: ${label}`);
    });

    expect(offenders).toEqual([]);
  });
});

const forbiddenPatterns = [
  {
    label: 'raw <select> should use AdminFormSelect',
    pattern: /<select[\s>]/,
  },
  {
    label: 'native date input should use AdminFormDatePickerField',
    pattern: /type=(["'])date\1/,
  },
  {
    label: 'native datetime-local input should use AdminFormDatePickerField',
    pattern: /type=(["'])datetime-local\1/,
  },
  {
    label: 'native month input should use AdminFormDatePickerField',
    pattern: /type=(["'])month\1/,
  },
  {
    label: 'native time input should use AdminFormDatePickerField',
    pattern: /type=(["'])time\1/,
  },
  {
    label: 'legacy filter-grid should use AdminFormGridFields',
    pattern: /className=(["'])filter-grid/,
  },
  {
    label: 'legacy filter-row should use AdminFilterChipGroup or a page-specific shared layout',
    pattern: /className=(["'])filter-row(?:\s|["'])/,
  },
  {
    label: 'page code should not reuse admin-filter-panel-body directly',
    pattern: /admin-filter-panel-body/,
  },
];

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.spec.tsx')) {
      return [];
    }

    return [path];
  });
}
