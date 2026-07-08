import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin Link prefetch policy', () => {
  it('disables Next Link prefetch across Admin Web navigation and shared link atoms', () => {
    const offenders = productionTsxFiles()
      .flatMap((filePath) => linkOpenTagsWithoutPrefetch(filePath))
      .map(({ filePath, tag }) => `${relative(process.cwd(), filePath).replaceAll('\\', '/')}: ${tag}`);

    expect(offenders).toEqual([]);
  });
});

function productionTsxFiles() {
  return ['app', 'components']
    .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
    .filter((filePath) => !filePath.endsWith('.spec.tsx'));
}

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return listTsxFiles(entryPath);
    }

    return entry.endsWith('.tsx') ? [entryPath] : [];
  });
}

function linkOpenTagsWithoutPrefetch(filePath: string) {
  const source = readFileSync(filePath, 'utf8');
  return [...source.matchAll(/<Link\b[\s\S]*?>/gu)]
    .map((match) => match[0].replace(/\s+/gu, ' ').trim())
    .filter((tag) => !tag.includes('prefetch={false}'))
    .map((tag) => ({ filePath, tag }));
}
