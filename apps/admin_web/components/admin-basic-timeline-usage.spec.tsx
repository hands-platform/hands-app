import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { globSync } from 'glob';

describe('AdminBasicTimeline usage', () => {
  it('keeps Vuexy basic timeline item markup behind the shared surface atom', () => {
    const rawTimelineItemPattern = /className=["'{`][^"'}]*vuexy-basic-timeline-item/;
    const offenders = globSync('app/**/*.tsx', { cwd: process.cwd() })
      .concat(globSync('components/**/*.tsx', { cwd: process.cwd() }))
      .map((filePath) => relative(process.cwd(), join(process.cwd(), filePath)).replaceAll('\\', '/'))
      .filter((filePath) => filePath !== 'components/admin-surface.tsx')
      .filter((filePath) => rawTimelineItemPattern.test(readFileSync(join(process.cwd(), filePath), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
