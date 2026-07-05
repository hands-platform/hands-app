import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin react-datepicker Vuexy usage', () => {
  it('keeps react-datepicker instances on the Vuexy calendar skin', () => {
    const offenders = listSourceFiles(join(process.cwd(), 'app'))
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('<DatePicker'))
      .flatMap((filePath) => datePickerSkinViolations(filePath));

    expect(offenders).toEqual([]);
  });
});

function datePickerSkinViolations(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  return datePickerTags(source).flatMap((tag) => {
    const violations: string[] = [];
    const location = `${relative(process.cwd(), filePath).replaceAll('\\', '/')}:${lineNumberForIndex(source, tag.index)}`;

    if (!tag.raw.includes('calendarClassName="calendar-vuexy-datepicker')) {
      violations.push(`${location} missing calendar-vuexy-datepicker`);
    }

    if (!tag.raw.includes('inline') && !tag.raw.includes('popperClassName="calendar-vuexy-datepicker-popper"')) {
      violations.push(`${location} missing calendar-vuexy-datepicker-popper`);
    }

    return violations;
  });
}

function datePickerTags(source: string) {
  const tags: Array<{ index: number; raw: string }> = [];
  const starts = source.matchAll(/<DatePicker\b/g);

  for (const match of starts) {
    const index = match.index ?? 0;
    const lineStart = source.lastIndexOf('\n', index) + 1;
    const indentation = source.slice(lineStart, index);
    const closingNeedle = `\n${indentation}/>`;
    const closingIndex = source.indexOf(closingNeedle, index);

    if (closingIndex === -1) {
      tags.push({ index, raw: source.slice(index) });
      continue;
    }

    tags.push({
      index,
      raw: source.slice(index, closingIndex + closingNeedle.length),
    });
  }

  return tags;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      return listSourceFiles(filePath);
    }

    if (!filePath.endsWith('.tsx') || filePath.endsWith('.spec.tsx')) {
      return [];
    }

    return [filePath];
  });
}

function lineNumberForIndex(source: string, index: number) {
  return source.slice(0, index).split(/\r\n|\r|\n/).length;
}
